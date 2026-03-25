# Explorer 0A: Harness Health（构建与运行时健康检查）

## 目标

验证整个系统的构建和运行时健康状态。任何失败 = P0。

## 检查清单

### 1. TypeScript 编译
```bash
cd wechat-bot && npx tsc --noEmit 2>&1
```
- 编译错误 = P0
- 新增 warning = P1

### 2. 测试套件
```bash
cd wechat-bot && bash test-all.sh 2>&1
```
- 测试失败 = P0
- 测试缺失（新代码无测试）= P1

### 3. Docker 容器状态
```bash
docker ps --filter "name=kaifeng" --format "{{.Names}} {{.Status}} {{.Ports}}"
docker logs kaifeng-bot --tail 20 2>&1
```
- 容器未运行 = P0
- 容器重启循环（Restarting）= P0
- 最近日志有 unhandled error = P1

### 4. iLink 连接性
```bash
# 检查 iLink WebSocket 连接
docker logs kaifeng-bot --tail 50 2>&1 | grep -i "ilink\|websocket\|connect\|disconnect"
```
- WebSocket 断开 = P0
- 认证失败 = P0
- 连接不稳定（频繁重连）= P1

### 5. 数据库完整性
```bash
sqlite3 data/leads.db "PRAGMA integrity_check; SELECT COUNT(*) FROM enterprises;"
```
- 完整性检查失败 = P0
- 表缺失 = P0

### 6. 依赖健康
```bash
cd wechat-bot && npm ls --depth=0 2>&1 | grep -i "ERR\|WARN\|missing"
```
- 缺失依赖 = P0
- 过期安全漏洞 = P1

### 7. Alibaba 容器状态
```bash
# 检查阿里云容器镜像是否可拉取（如已配置）
docker images | grep kaifeng 2>/dev/null
# 检查容器内环境变量完整性
docker exec kaifeng-bot env 2>/dev/null | grep -E "ANTHROPIC|ILINK|DB_PATH" | sed 's/=.*/=***/'
```
- 镜像不存在且容器未运行 = P0
- 关键环境变量未注入 = P0

### 8. Admin Console 健康
```bash
# 检查 admin 控制台端口是否响应（/test 端点）
curl -s --max-time 5 http://localhost:3456/test \
  -X POST -H "Content-Type: application/json" \
  -d '{"userId":"harness-check","text":"系统状态"}' | python3 -c "
import json, sys
try:
    r = json.load(sys.stdin)
    print('admin OK:', str(r)[:100])
except:
    print('admin FAIL: no valid response')
" 2>/dev/null || echo "admin console unreachable"
```
- Admin console 不响应 = P1（无法执行审批或查询）
- 响应含 SQLITE_ERROR = P0

### 9. 测试套件（vitest）
```bash
cd wechat-bot && npm test 2>&1 | tail -10
```
- vitest 测试失败 = P0
- 测试文件不存在 = P1（回归防护缺失）

## 输出格式

```json
[
  {
    "id": "harness-001",
    "priority": "P0",
    "category": "harness",
    "title": "tsc --noEmit 编译失败: 3个类型错误",
    "description": "bot.ts:42 — Property 'foo' does not exist on type 'Bar'",
    "fix_hint": "修复类型定义或添加类型断言",
    "files": ["wechat-bot/bot.ts"],
    "effort": "small"
  }
]
```

## 注意事项

- 这个 explorer 优先级最高——如果构建都过不了，其他改进没有意义
- 不修改任何文件，只读取和报告
- 如果 Docker 未运行，记录但不要尝试启动（留给 Execute 阶段）
