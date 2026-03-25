# Explorer: Admin Console E2E

## 目标
Hit the ACTUAL admin console API on Alibaba and verify tools work end-to-end.

## Checks

### 1. Health
```bash
curl -sf http://47.112.211.102/api/health | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status']=='ok'; print('health OK')"
```

### 2. Auth Rejection
```bash
curl -s -o /dev/null -w '%{http_code}' -X POST http://47.112.211.102/api/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"test"}]}'
# Should return 401
```

### 3. Chat — 今日概览
```bash
curl -s -X POST http://47.112.211.102/api/chat \
  -H "Authorization: Bearer KaiFengZhiGu2026ChengGong" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"今日概览"}]}' | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert 'content' in d or 'toolResults' in d, 'No content in response'
print('chat OK:', str(d.get('content',''))[:100])
"
```

### 4. Webhook Signature Rejection
```bash
curl -s -o /dev/null -w '%{http_code}' 'http://47.112.211.102/wechat/webhook?signature=bad&timestamp=1&nonce=1&echostr=test'
# Should return 403
```

### 5. Gallery Serves Content
```bash
curl -sf http://47.112.211.102/ | grep -qi 'password\|login\|凯丰'
```

## Output
Report failures as P0 findings. If chat response is empty or error, that's P0.
