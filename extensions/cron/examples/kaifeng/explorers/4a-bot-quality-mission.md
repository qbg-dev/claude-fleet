# Explorer 4A: Bot Quality（微信机器人质量检查）

## 目标

检查 WeChat bot 的运行质量：未回答的问题、工具错误、知识空白、响应质量、权限问题。

## 检查清单

### 1. 消息日志审计
```bash
# 检查最近的 bot 日志
docker logs kaifeng-bot --tail 100 2>&1
```
审查要点：
- 用户消息没有得到回复 = P0
- 回复延迟 >30秒 = P1
- 工具调用失败 = P1
- 未处理异常 = P0

### 2. 未回答问题
```bash
# 搜索日志中的未回答模式
docker logs kaifeng-bot --tail 500 2>&1 | grep -i "no.*answer\|未回答\|fallback\|不知道\|抱歉.*无法"
```
- 发现未回答的问题 = P0（直接影响客户体验）
- 频繁出现同一类问题 = P0（知识库缺口）

### 3. 工具错误
```bash
docker logs kaifeng-bot --tail 500 2>&1 | grep -i "error\|Error\|ERROR\|failed\|timeout\|exception"
```
- 工具调用连续失败 = P0
- 偶尔超时 = P1

### 4. 知识库覆盖
```bash
# 检查知识库文件
wc -l knowledge/*.md
cat knowledge/faq.md | head -50
```
对照常见客户问题检查知识库覆盖：
- 价格和付款方式
- 面积和户型
- 交付时间
- 位置和交通
- 产权性质（红本）
- 入驻条件
- 周边配套
- 优惠政策

缺失的关键问题 = P1

### 5. 响应质量抽查
```bash
# 检查消息存储（如果有持久化）
docker logs kaifeng-bot --tail 200 2>&1 | grep -A2 "reply\|response\|回复"
```
检查：
- 回复是否准确（与知识库一致）
- 回复是否自然（不像机器人）
- 回复是否包含联系方式（王小姐 13824203556）
- 回复长度是否合适（不过长也不过短）

质量问题 = P2

### 6. 权限系统
```bash
# 检查权限配置
cat wechat-bot/permissions.ts | head -50
docker logs kaifeng-bot --tail 200 2>&1 | grep -i "permission\|权限\|denied\|blocked"
```
- 权限配置错误 = P0
- 正常用户被误拦截 = P0
- 权限日志异常 = P1

### 7. 系统提示词质量
```bash
cat knowledge/system-prompt.md
```
检查：
- 是否包含最新产品信息
- 是否有明确的角色设定
- 是否有兜底回复策略（不知道时怎么说）
- 是否有联系方式引导

过时信息 = P1

### 8. 容器资源
```bash
docker stats kaifeng-bot --no-stream --format "{{.CPUPerc}} {{.MemUsage}} {{.NetIO}}"
```
- 内存使用 >80% = P1
- CPU 持续 >50% = P2

### 9. Admin Console 聊天质量
```bash
# 通过 /test 端点测试 admin console 的核心问答能力
curl -s --max-time 30 -X POST "http://localhost:3456/test" \
  -H "Content-Type: application/json" \
  -d '{"userId":"explorer-4a","text":"2成首付是什么意思？凯丰智谷在哪里？"}' | python3 -c "
import json, sys
try:
    r = json.load(sys.stdin)
    reply = r.get('reply', '')
    print('reply:', reply[:200])
    # Check for key facts
    checks = ['2成', '首付', '大亚湾', '凯丰', '3500']
    for kw in checks:
        print(f'  has \"{kw}\":', kw in reply)
except Exception as e:
    print('FAIL:', e)
" 2>/dev/null
```
- 回复不包含"2成"或"首付"相关信息 = P1（知识库缺失）
- 回复不包含地址信息 = P1
- 回复超过 500 字 = P2（过长，用户体验差）

### 10. 工具调用成功率
```bash
# 检查日志中工具调用成功/失败比例
docker logs kaifeng-bot --tail 200 2>&1 | python3 -c "
import sys, re
lines = sys.stdin.read()
tool_calls = len(re.findall(r'tool_call|tool_use|function_call', lines, re.I))
tool_errors = len(re.findall(r'tool.*error|tool.*fail|function.*error', lines, re.I))
print(f'Tool calls detected: {tool_calls}')
print(f'Tool errors: {tool_errors}')
if tool_calls > 0:
    success_rate = (tool_calls - tool_errors) / tool_calls * 100
    print(f'Approx success rate: {success_rate:.0f}%')
" 2>/dev/null
```
- 工具错误率 >20% = P1
- 工具错误率 >50% = P0（工具系统故障）

## 输出格式

```json
[
  {
    "id": "bot-001",
    "priority": "P0",
    "category": "bot-quality",
    "title": "客户询问'首付多少'未得到准确回复",
    "description": "日志显示客户询问首付比例，bot回复了通用信息但未提到2成首付的具体政策",
    "fix_hint": "在 knowledge/faq.md 中添加明确的首付信息：2成首付，红本产权",
    "files": ["knowledge/faq.md"],
    "effort": "trivial"
  }
]
```

## 注意事项

- 不要修改 bot 代码或知识库——只审计和报告
- 如果 Docker 容器未运行，只报告 P0 finding，不要尝试启动
- 关注的是客户体验质量，不只是技术指标
- 中文日志可能包含 UTF-8 编码问题——注意 grep 可能漏掉
