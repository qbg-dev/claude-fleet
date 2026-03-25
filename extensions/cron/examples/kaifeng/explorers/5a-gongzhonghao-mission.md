# Explorer 5A: 公众号 & Content（微信公众号与内容健康检查）

## 目标

检查微信公众号的运营健康状态：菜单配置、文章新鲜度、模板库质量、知识库更新。

## 检查清单

### 1. 公众号菜单配置
```bash
# 检查菜单配置是否完整（5个栏目）
cat knowledge/wechat-menu.json 2>/dev/null || echo "menu config not found"
# 检查是否包含核心功能
grep -i "预约看楼\|联系我们\|项目介绍\|企业查询\|厂房\|看楼" knowledge/*.md knowledge/*.json 2>/dev/null | head -20
```
- 菜单未配置 = P0（公众号无入口）
- 缺少"预约看楼"入口 = P0（核心转化路径）
- 少于 4 个菜单栏目 = P1

### 2. 近期文章发布
```bash
# 检查文章目录是否有近7天更新的内容
find knowledge/ -name "*.md" -newer /tmp/week-ago 2>/dev/null || \
  python3 -c "
import os, time
week_ago = time.time() - 7 * 86400
for f in os.listdir('knowledge/'):
    if f.endswith('.md'):
        mtime = os.path.getmtime(f'knowledge/{f}')
        age_days = (time.time() - mtime) / 86400
        print(f'{f}: {age_days:.1f} days old')
"
```
- 超过 7 天无新内容 = P2（内容运营停滞）
- 超过 14 天无新内容 = P1
- 超过 30 天无新内容 = P0（公众号失活）

### 3. 模板库健康
```bash
# 统计公众号模板数量
ls knowledge/templates/ 2>/dev/null | wc -l
# 检查模板目录是否存在
ls -la knowledge/templates/ 2>/dev/null | head -20
# 抽查模板文件完整性（HTML 是否有基本结构）
head -5 knowledge/templates/*.html 2>/dev/null | head -30
```
- 模板目录不存在 = P1
- 模板数量 < 10 = P1（内容多样性不足）
- 有 broken HTML（无闭合标签）= P1

### 4. 内容新鲜度（知识库）
```bash
# 检查知识库文件最近修改时间
python3 -c "
import os, time
files = [f for f in os.listdir('knowledge/') if f.endswith('.md')]
for f in sorted(files):
    path = f'knowledge/{f}'
    age = (time.time() - os.path.getmtime(path)) / 86400
    print(f'{f}: {age:.0f} days old')
" 2>/dev/null
```
重点检查：
- `faq.md` — 常见问题是否与最新政策一致（2成首付、2026年交付）
- `system-prompt.md` — 是否含最新产品参数
- `product-info.md`（如存在）— 价格/面积是否最新

过期知识库 = P1

### 5. AI 生成质量抽查
```bash
# 检查最新的模板内容质量
cat knowledge/templates/$(ls -t knowledge/templates/ 2>/dev/null | head -1) 2>/dev/null | head -40
# 检查是否有占位符未替换
grep -rn "{{\|PLACEHOLDER\|TODO\|TBD\|FILL_IN" knowledge/ 2>/dev/null
```
- 未替换的模板占位符 = P1（影响发送质量）
- 模板包含错误信息（错误地址/价格）= P0

### 6. 关注者增长趋势
```bash
# 检查是否有粉丝数据记录（如果已集成分析）
sqlite3 data/leads.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%follow%'" 2>/dev/null
# 或检查日志中的关注事件
docker logs kaifeng-bot --tail 100 2>&1 | grep -i "subscribe\|follow\|关注\|取关" 2>/dev/null
```
- 无关注数据追踪 = P2（建议添加关注事件埋点）
- 近7天取关数 > 关注数 = P1（内容质量问题）

## 输出格式

```json
[
  {
    "id": "gzh-001",
    "priority": "P1",
    "category": "gongzhonghao",
    "title": "知识库 faq.md 已 18 天未更新",
    "description": "knowledge/faq.md 最后修改于 2026-03-06，距今 18 天。可能包含过时信息",
    "fix_hint": "检查首付比例、交付时间、联系方式是否与最新销售政策一致",
    "files": ["knowledge/faq.md"],
    "effort": "small"
  }
]
```

## 注意事项

- 只读操作，不修改知识库或模板
- 如果 knowledge/ 目录不存在，返回 P0 finding
- 检查微信公众号配置时，注意公众号 API 可能未集成——标记为 P2 而非 P0
- 模板质量抽查取最新的 3 个即可，不需要全量扫描
