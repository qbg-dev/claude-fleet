# Explorer 3A: Scraping Health（抓取系统健康检查）

## 目标

检查 QCC 抓取子系统的健康状态：cookie 有效性、抓取进度、错误模式、新机会。

## 检查清单

### 1. Cookie 有效期
```bash
# 检查 cookie 文件修改时间
ls -la data/cookies.json data/server_cookies.json 2>/dev/null
python3 -c "
import json, os, time
for f in ['data/cookies.json', 'data/server_cookies.json']:
    if os.path.exists(f):
        age_hours = (time.time() - os.path.getmtime(f)) / 3600
        print(f'{f}: {age_hours:.1f} hours old')
    else:
        print(f'{f}: NOT FOUND')
"
```
- Cookie 超过 24 小时 = P1
- Cookie 超过 48 小时 = P0（可能已过期）
- Cookie 文件不存在 = P0

### 2. 抓取组合进度
```sql
SELECT
  sr.filter_combo,
  COUNT(*) as runs,
  MAX(sr.created_at) as last_run,
  SUM(sr.new_count) as total_new,
  SUM(sr.overlap_count) as total_overlap,
  ROUND(SUM(sr.overlap_count) * 100.0 / NULLIF(SUM(sr.new_count + sr.overlap_count), 0), 1) as overlap_pct
FROM scrape_runs sr
GROUP BY sr.filter_combo
ORDER BY last_run DESC;
```
- 重叠率 >80% 的组合 = P2（标记为已耗尽）
- 所有组合重叠率都 >80% = P1（需要切换策略）

### 3. 最近错误
```sql
SELECT
  created_at, filter_combo, status, error_message
FROM scrape_runs
WHERE status != 'success'
ORDER BY created_at DESC
LIMIT 10;
```
- 连续3次失败同一错误 = P0（系统性问题）
- 最近出现 "操作过于频繁" = P1（需要降频）
- 最近出现 "用户验证" / CAPTCHA = P1

### 4. 新区域机会
```sql
-- 已覆盖的区域/资质组合
SELECT district, qualification, COUNT(*) as cnt
FROM enterprises
WHERE source = 'qcc_scrape'
GROUP BY district, qualification;
```
对照目标区域清单（坪山、坑梓、龙岗、龙华）和资质类型（规上企业、专精特新、小巨人、高新技术），找出未覆盖的组合。

- 目标组合未覆盖 >50% = P1
- 全部覆盖 = P2（考虑关键词搜索等替代策略）

### 5. 数据新鲜度
```sql
SELECT
  DATE(created_at) as day,
  COUNT(*) as new_enterprises
FROM enterprises
WHERE source = 'qcc_scrape'
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 7;
```
- 连续 2 天无新数据 = P1
- 连续 5 天无新数据 = P0

### 6. Pass 2 充实积压
```sql
SELECT COUNT(*) as needs_enrichment
FROM enterprises
WHERE business_scope IS NULL OR business_scope = ''
AND source = 'qcc_scrape';
```
- 待充实 >100 家 = P1（Pass 2 跟不上 Pass 1）

### 7. 脚本健康
```bash
# 检查脚本是否可运行
python3 -c "import src.scraper.run_scrape" 2>&1
python3 -c "import src.scraper.refresh_cookies" 2>&1
```
- 导入错误 = P0

### 8. 坑梓覆盖专项
```sql
-- 检查坑梓（坪山子区域）的专项覆盖
SELECT
  district,
  COUNT(*) as cnt,
  AVG(industry_match_score) as avg_score,
  MAX(created_at) as last_scraped
FROM enterprises
WHERE district LIKE '%坑梓%'
  OR (district = '坪山' AND address LIKE '%坑梓%')
GROUP BY district;
```
对照 scrape_runs 表检查是否有专门针对坑梓的抓取任务：
```sql
SELECT region_filter, COUNT(*) as runs, MAX(completed_at) as last_run
FROM scrape_runs
WHERE region_filter LIKE '%坑梓%'
GROUP BY region_filter;
```
- 坑梓从未被专项抓取 = P1（目标区域覆盖不完整）
- 坑梓企业 < 10 家 = P2（需要补充）

### 9. 持久化 Profile 健康
```bash
# 检查 Playwright 持久化 profile 目录
ls -la data/chrome-profile/ 2>/dev/null | head -10
# 检查 profile 最近使用时间
python3 -c "
import os, time
profile = 'data/chrome-profile'
if os.path.exists(profile):
    age = (time.time() - os.path.getmtime(profile)) / 3600
    print(f'profile age: {age:.1f} hours')
else:
    print('no persistent profile found')
" 2>/dev/null
```
- profile 目录不存在 = P1（每次抓取都需要重新登录）
- profile 超过 72 小时未使用 = P2（Cookie 可能已失效）

### 10. Alibaba 容器网络连通性
```bash
# 检查容器内能否访问 QCC（通过 docker exec）
docker exec kaifeng-bot curl -s --max-time 10 \
  -H "User-Agent: Mozilla/5.0" \
  "https://www.qcc.com" -o /dev/null -w "%{http_code}" 2>/dev/null || \
  echo "container exec failed or not running"
```
- HTTP 返回 200/302 = 正常
- HTTP 返回 403/429 = P1（被限速或封锁）
- 连接超时 = P1（容器网络问题）

## 输出格式

```json
[
  {
    "id": "scrape-001",
    "priority": "P1",
    "category": "scraping-health",
    "title": "Cookie 已过期36小时",
    "description": "data/cookies.json 最后更新于36小时前，QCC 登录可能已失效",
    "fix_hint": "运行 python3 src/scraper/refresh_cookies.py 刷新cookie",
    "effort": "trivial"
  }
]
```

## 注意事项

- 不要启动任何抓取——只检查状态
- scrape_runs 表可能不存在——如果不存在，检查文件系统中的日志
- 如果当前被限速（rate limited），不要标记为 P0，标记为 P1 并建议等待冷却
