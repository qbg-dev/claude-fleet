# Explorer 7A: Conversion & Analytics（转化漏斗与数据分析）

## 目标

追踪从线索到成交的完整漏斗指标，评估各渠道的投入产出比，发现转化瓶颈。

## 检查清单

### 1. 邮件打开率
```sql
-- 打开率（如果有 opened_at 追踪）
SELECT
  ec.name as campaign,
  COUNT(*) as sent_count,
  COUNT(es.opened_at) as opened_count,
  ROUND(COUNT(es.opened_at) * 100.0 / COUNT(*), 1) as open_rate_pct
FROM email_sends es
JOIN email_campaigns ec ON ec.id = es.campaign_id
WHERE es.status = 'sent'
GROUP BY ec.id, ec.name
ORDER BY ec.created_at DESC;
```
- 打开率 <10% = P1（主题行或发件人声誉问题）
- 打开率 <5% = P0（发送策略需要根本性调整）
- 无打开数据（opened_at 全为 NULL）= P2（需要添加追踪像素）

### 2. 回复率
```sql
-- 回复率（replied_at 字段）
SELECT
  COUNT(*) as sent_count,
  COUNT(replied_at) as replied_count,
  ROUND(COUNT(replied_at) * 100.0 / NULLIF(COUNT(*), 0), 1) as reply_rate_pct
FROM email_sends
WHERE status = 'sent';
```
- 回复率 >5% = P0 正面（优先跟进）
- 回复率 <1% = P1（内容或目标人群不匹配）

### 3. 线索转化漏斗
```sql
-- 全漏斗状态分布
SELECT
  status,
  COUNT(*) as cnt,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM email_sends WHERE status != 'rejected'), 1) as pct
FROM email_sends
WHERE status != 'rejected'
GROUP BY status
ORDER BY
  CASE status
    WHEN 'queued' THEN 1
    WHEN 'approved' THEN 2
    WHEN 'sent' THEN 3
    WHEN 'bounced' THEN 4
    ELSE 5
  END;
```
检查各阶段转化率：
- `queued` → `approved` 转化率 <50% = P1（审批瓶颈）
- `sent` → `opened` 转化率 <10% = P1
- `opened` → `replied` 转化率 <5% = P2（内容吸引力不足）

### 4. 企业评分 vs 邮件结果
```sql
-- 高分企业的回复率是否优于低分企业
SELECT
  CASE
    WHEN e.industry_match_score >= 80 THEN '高分(≥80)'
    WHEN e.industry_match_score >= 60 THEN '中分(60-79)'
    ELSE '低分(<60)'
  END as score_tier,
  COUNT(*) as sent,
  COUNT(es.replied_at) as replied,
  ROUND(COUNT(es.replied_at) * 100.0 / NULLIF(COUNT(*), 0), 1) as reply_rate
FROM email_sends es
JOIN enterprises e ON e.id = es.enterprise_id
WHERE es.status = 'sent'
GROUP BY score_tier
ORDER BY score_tier;
```
- 高分企业回复率不优于低分 = P1（评分模型需要校正）

### 5. 响应时间追踪
```sql
-- 从发送到打开的平均时长（小时）
SELECT
  AVG(
    CAST((JULIANDAY(opened_at) - JULIANDAY(sent_at)) * 24 AS INTEGER)
  ) as avg_hours_to_open
FROM email_sends
WHERE status = 'sent'
  AND opened_at IS NOT NULL;

-- 从发送到回复的平均时长
SELECT
  AVG(
    CAST((JULIANDAY(replied_at) - JULIANDAY(sent_at)) * 24 AS INTEGER)
  ) as avg_hours_to_reply
FROM email_sends
WHERE status = 'sent'
  AND replied_at IS NOT NULL;
```
- 平均打开时长 > 48 小时 = P2（发送时机可能不对）

### 6. 日/周活动趋势
```sql
-- 过去 14 天每日活动量
SELECT
  DATE(sent_at) as day,
  COUNT(*) as sent,
  COUNT(opened_at) as opened,
  COUNT(replied_at) as replied
FROM email_sends
WHERE sent_at >= DATE('now', '-14 days')
GROUP BY DATE(sent_at)
ORDER BY day DESC;
```
- 连续 5 天无活动 = P1（系统可能暂停）

### 7. 公众号互动数据
```bash
# 检查是否有公众号消息互动记录
docker logs kaifeng-bot --tail 200 2>&1 | grep -i "关注\|扫码\|预约\|看楼\|inquiry" 2>/dev/null | wc -l
# 检查是否有会话数据持久化
sqlite3 data/leads.db "SELECT name FROM sqlite_master WHERE type='table'" 2>/dev/null
```
- 无公众号互动记录 = P2（可能未接通或流量不足）
- 有互动但无后续跟进 = P1（转化断层）

### 8. 渠道 ROI 对比
```bash
# 统计各来源线索的邮件转化情况
sqlite3 data/leads.db "
SELECT
  e.source,
  COUNT(DISTINCT e.id) as enterprises,
  COUNT(DISTINCT es.id) as emails_sent,
  COUNT(DISTINCT CASE WHEN es.replied_at IS NOT NULL THEN es.id END) as replies
FROM enterprises e
LEFT JOIN email_sends es ON es.enterprise_id = e.id AND es.status = 'sent'
GROUP BY e.source
ORDER BY replies DESC;
"
```
- xlsx 导入线索回复率 vs qcc_scrape 回复率对比
- 回复率低的来源 = P2（考虑停止该渠道）

## 输出格式

```json
[
  {
    "id": "conv-001",
    "priority": "P1",
    "category": "conversion",
    "title": "邮件打开率12%，但回复率仅0.8%",
    "description": "6封已发邮件中，2封有打开记录(33%)，但只有1封(17%)收到回复。样本量小，需要更多数据。",
    "fix_hint": "检查邮件内容是否有明确的行动号召（CTA），考虑加入'回复预约看楼时间'等直接引导",
    "effort": "small"
  }
]
```

## 注意事项

- 样本量 <10 时，百分比数据仅作参考，不触发 P0/P1
- email_sends 中 opened_at 可能为 NULL（追踪像素未部署）——如为全 NULL，标记 P2 而非报错
- 只读操作，不修改任何数据
- 关注趋势方向（是否在改善），而非绝对值
