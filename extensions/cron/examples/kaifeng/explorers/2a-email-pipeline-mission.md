# Explorer 2A: Email Pipeline（邮件管道健康检查）

## 目标

检查邮件发送管道的各个环节：预热合规、退信率、模板质量、审批队列、退订机制。

## 检查清单

### 1. 预热合规
```sql
SELECT
  DATE(sent_at) as day,
  COUNT(*) as sent_count
FROM email_sends
WHERE sent_at >= DATE('now', '-7 days')
GROUP BY DATE(sent_at)
ORDER BY day DESC;
```
- 检查是否超过每日限额（初始10封/天，每周+10）
- 超限 = P0

### 2. 退信率
```sql
SELECT
  COUNT(*) as total_sent,
  COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
  ROUND(COUNT(CASE WHEN status = 'bounced' THEN 1 END) * 100.0 / COUNT(*), 1) as bounce_pct
FROM email_sends
WHERE sent_at >= DATE('now', '-30 days');
```
- 退信率 >3% = P0（触发自动暂停，见 `protocols/email-bounce.md`）
- 退信率 >1% = P1

### 3. 模板新鲜度
```bash
# 检查模板最后修改时间
stat -f "%m %N" src/mailer/templates/*.html src/mailer/template_renderer.py 2>/dev/null
```
- 模板超过 7 天未更新 = P2
- 模板不存在 = P1

### 4. 已审批但未发送
```sql
SELECT COUNT(*) as approved_unsent,
  MIN(approved_at) as oldest_approval
FROM email_queue
WHERE status = 'approved' AND sent_at IS NULL;
```
- 已审批 >24小时未发送 = P1（见 `protocols/approval-backlog.md`）
- 已审批 >48小时 = P0

### 5. 主题行质量
```sql
SELECT subject, COUNT(*) as times_used,
  AVG(CASE WHEN status = 'opened' THEN 1.0 ELSE 0.0 END) as open_rate
FROM email_sends
GROUP BY subject
ORDER BY times_used DESC
LIMIT 10;
```
- 打开率 <10% 的主题行 = P1（需要优化）
- 只有1个主题行 = P2（需要 A/B 测试）

### 6. 退订机制
```bash
# 检查所有邮件模板是否包含退订链接
grep -l "退订\|unsubscribe\|取消订阅" src/mailer/templates/*.html 2>/dev/null
```
- 任何模板缺少退订 = P0（法律要求）

### 7. SMTP 连接
```python
# 检查 SMTP 配置是否存在
python3 -c "
import os
smtp_host = os.environ.get('SMTP_HOST', '')
smtp_user = os.environ.get('SMTP_USER', '')
print(f'SMTP configured: {bool(smtp_host and smtp_user)}')
print(f'Host: {smtp_host[:20]}...' if smtp_host else 'Host: NOT SET')
"
```
- SMTP 未配置 = P1（阻塞邮件发送）

### 8. 邮件队列深度
```sql
SELECT
  COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
FROM email_sends;
```
- bounced > 0 且 bounce_pct > 3% = P0（见检查 #2）

### 9. 自动回复健康
```bash
# 检查是否有收件箱轮询脚本
ls src/mailer/check_replies.py src/mailer/inbox_poller.py 2>/dev/null || echo "no reply-polling script found"
# 检查最近是否有 replied_at 记录
sqlite3 data/leads.db "
SELECT COUNT(*) as with_reply, MIN(replied_at) as first_reply, MAX(replied_at) as last_reply
FROM email_sends WHERE replied_at IS NOT NULL;
" 2>/dev/null
```
- 无收件箱轮询脚本 = P2（无法自动检测回复）
- 有回复但超过 48 小时未处理 = P1

### 10. 收件箱轮询状态
```bash
# 检查 IMAP/收件箱轮询是否配置
python3 -c "
import os
imap_host = os.environ.get('IMAP_HOST', '')
imap_user = os.environ.get('IMAP_USER', os.environ.get('SMTP_USER', ''))
print(f'IMAP configured: {bool(imap_host)}')
print(f'User: {imap_user[:20]}...' if imap_user else 'User: NOT SET')
" 2>/dev/null
# 检查最近的收件箱轮询日志
docker logs kaifeng-bot --tail 100 2>&1 | grep -i "inbox\|imap\|reply\|回复" 2>/dev/null | tail -10
```
- IMAP 未配置 = P2（回复无法自动捕获）
- 收件箱轮询报错 = P1

## 输出格式

```json
[
  {
    "id": "email-001",
    "priority": "P0",
    "category": "email-pipeline",
    "title": "退信率4.2%，超过3%阈值",
    "description": "过去30天发送87封，退信4封(4.2%)。需要立即暂停发送并排查退信地址",
    "fix_hint": "执行 protocols/email-bounce.md 流程：暂停发送，标记退信地址，通知管理员",
    "effort": "small"
  }
]
```

## 注意事项

- 当前 schema 使用 `email_sends` 表（无独立 `email_queue` 表），以 `status` 字段区分状态
- 不要尝试发送任何邮件
- 不要修改模板
- 如果 SMTP 未配置，这是已知状态，标记为 P1 而非 P0
- `email_sends.status` 有效值：queued, approved, sent, bounced, rejected
