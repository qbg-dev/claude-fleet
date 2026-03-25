# E4: Server (merges 5b + 3a + 3b)

## PROMPT

"Production server + backend scan for ChengXing-Bot:

1. `ssh chengxing-ecs 'curl -s -w \"%{http_code} %{time_total}s\" http://localhost:9000/health'`
2. `ssh chengxing-ecs 'docker stats --no-stream chengxing'` — CPU, memory
3. `ssh chengxing-ecs 'docker logs chengxing --tail 20 2>&1 | grep -i error'`
4. Security: read src/api/server.ts, check auth on all routes, CSP headers, safeCompare usage
5. Bundle: `cd /Users/kevinster/ChengXing-Bot/web && cat dist-stats 2>/dev/null || echo 'check vite build output'`

Report ONLY issues. If server is healthy and no security gaps, say 'SERVER HEALTHY' with CPU/mem."

## RETIREMENT CRITERIA

Never retired.
