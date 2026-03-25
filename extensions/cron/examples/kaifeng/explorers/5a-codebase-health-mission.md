# Explorer 5A: Codebase Health（代码质量检查）

## 目标

检查代码库的整体健康：TypeScript 类型安全、无用代码、待办事项、测试覆盖、安全漏洞。

## 检查清单

### 1. TypeScript `any` 使用
```bash
grep -rn ": any\|as any\|<any>" wechat-bot/*.ts --include="*.ts" | grep -v node_modules | grep -v "*.d.ts"
```
- any 使用 >10处 = P2
- 新增 any（对比上次检查）= P1

### 2. 无用代码
```bash
# 检查未使用的导出
grep -rn "export " wechat-bot/*.ts | grep -v "node_modules"
# 检查注释掉的代码块
grep -rn "^[[:space:]]*//" wechat-bot/*.ts | grep -v "node_modules" | grep -v "TODO\|FIXME\|NOTE\|HACK" | wc -l
```
- 大量注释代码 = P2
- 明显的死代码（从未调用的 export）= P2

### 3. TODO/FIXME 审计
```bash
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP" wechat-bot/ src/ --include="*.ts" --include="*.py" | grep -v node_modules
```
- FIXME 或 HACK = P1（应该修复）
- TODO 超过 30 天未处理 = P2
- 新增 TODO = 记录但不标记优先级

### 4. 测试覆盖
```bash
# 检查测试文件
ls -la wechat-bot/test-all.sh test/ 2>/dev/null
# 检查哪些模块有测试
find test/ wechat-bot/ -name "*.test.*" -o -name "test-*" 2>/dev/null | grep -v node_modules
```
对照主要模块检查测试覆盖：
- `wechat-bot/bot.ts` — 核心逻辑
- `wechat-bot/router.ts` — 路由
- `wechat-bot/tools.ts` — 工具调用
- `wechat-bot/permissions.ts` — 权限
- `src/scraper/` — 抓取脚本
- `src/scoring/` — 评分逻辑
- `src/pipeline/` — 管道

缺少测试的核心模块 = P1

### 5. npm audit
```bash
cd wechat-bot && npm audit --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    vulns = data.get('vulnerabilities', {})
    critical = sum(1 for v in vulns.values() if v.get('severity') == 'critical')
    high = sum(1 for v in vulns.values() if v.get('severity') == 'high')
    print(f'Critical: {critical}, High: {high}, Total: {len(vulns)}')
except: print('audit parse failed')
"
```
- Critical 漏洞 = P0
- High 漏洞 = P1

### 6. Python 依赖检查
```bash
# 检查 requirements.txt 是否与实际使用一致
pip3 list --outdated 2>/dev/null | head -10
python3 -c "import playwright; print('playwright OK')" 2>&1
python3 -c "import sqlite3; print('sqlite3 OK')" 2>&1
```

### 7. 代码风格一致性
```bash
# 检查混用的缩进风格
grep -rn "	" wechat-bot/*.ts | head -5  # tabs
grep -Prn "^( {2})" wechat-bot/*.ts | head -5  # 2-space
grep -Prn "^( {4})" wechat-bot/*.ts | head -5  # 4-space
```
- 混用缩进风格 = P2

### 8. 敏感信息泄露
```bash
grep -rni "password\|secret\|api.key\|token" wechat-bot/*.ts src/**/*.py --include="*.ts" --include="*.py" | grep -v node_modules | grep -v "\.env\|env\.\|process\.env\|os\.environ"
```
- 硬编码的密钥或密码 = P0
- .env 文件被 git track = P0

### 9. 文件大小异常
```bash
find . -name "*.ts" -o -name "*.py" | grep -v node_modules | xargs wc -l | sort -rn | head -10
```
- 单文件超过 500 行 = P2（考虑拆分）

### 10. 测试覆盖率（vitest）
```bash
# 检查 vitest 测试是否存在且全部通过
cd wechat-bot && ls test/regression/*.test.ts 2>/dev/null | wc -l
cd wechat-bot && npm test 2>&1 | grep -E "pass|fail|Tests" | tail -5
```
- 测试文件数量 < 4 = P1（回归覆盖不完整）
- 任何测试失败 = P0
- npm test 脚本不存在或非 vitest = P1

### 11. Pre-commit Gate 合规
```bash
# 检查 git hooks 是否已安装
ls .git/hooks/pre-commit 2>/dev/null && echo "pre-commit hook exists" || echo "no pre-commit hook"
# 检查最近 5 次 commit 是否都通过了 tsc
git log --oneline -5 2>/dev/null
# 检查是否有直接 commit 绕过测试的痕迹（--no-verify）
git log --oneline -20 2>/dev/null | grep -i "no-verify\|skip\|bypass" || echo "no bypass commits found"
```
- pre-commit hook 缺失 = P2（无自动质量门控）
- 发现 --no-verify commit = P1

## 输出格式

```json
[
  {
    "id": "code-001",
    "priority": "P1",
    "category": "codebase-health",
    "title": "npm audit 发现2个 high 级别漏洞",
    "description": "wechat-bot 依赖中有2个 high 漏洞: prototype-pollution in lodash, ReDOS in validator",
    "fix_hint": "运行 npm audit fix 或手动升级受影响的包",
    "files": ["wechat-bot/package.json"],
    "effort": "small"
  }
]
```

## 注意事项

- 只读操作，不修改任何代码
- node_modules 内的问题通过 npm audit 报告，不要单独检查
- 关注的是可行动的问题，不是风格偏好
- Python 代码（src/）和 TypeScript 代码（wechat-bot/）都要检查
