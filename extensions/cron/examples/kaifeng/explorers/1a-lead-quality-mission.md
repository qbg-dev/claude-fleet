# Explorer 1A: Lead Quality（线索数据质量审计）

## 目标

审计 leads.db 中的数据质量，发现缺失、重复、无效数据。每个问题返回 Finding。

## 检查清单

### 1. 缺失邮箱
```sql
SELECT COUNT(*) as no_email FROM enterprises e
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.enterprise_id = e.id AND c.type = 'email');
```
- 有效邮箱覆盖率 <30% = P1
- 高分企业（industry_match_score >= 70）无邮箱 = P0

### 2. 重复企业
```sql
SELECT e1.id, e1.name, e2.id, e2.name
FROM enterprises e1, enterprises e2
WHERE e1.id < e2.id
AND (e1.name LIKE '%' || SUBSTR(e2.name, 3, 6) || '%'
     OR e2.name LIKE '%' || SUBSTR(e1.name, 3, 6) || '%')
LIMIT 20;
```
- 发现重复 = P1（日常tick）, P0（coherency review）

### 3. 未评分企业
```sql
SELECT COUNT(*) FROM enterprises WHERE industry_match_score IS NULL OR industry_match_score = 0;
```
- 未评分数量 >10% = P1

### 4. 区域标准化
```sql
SELECT district, COUNT(*) as cnt FROM enterprises
GROUP BY district ORDER BY cnt DESC;
```
- 检查：同一区域不同写法（"坪山" vs "坪山区" vs "深圳市坪山区"）
- 不一致 = P1

### 5. 邮箱格式验证
```sql
SELECT c.id, c.value, e.name FROM contacts c
JOIN enterprises e ON c.enterprise_id = e.id
WHERE c.type = 'email'
AND (c.value NOT LIKE '%@%.%'
     OR c.value LIKE '%@%@%'
     OR c.value LIKE '% %');
```
- 无效邮箱 = P1

### 6. 电话格式验证
```sql
SELECT c.id, c.value, e.name FROM contacts c
JOIN enterprises e ON c.enterprise_id = e.id
WHERE c.type = 'phone'
AND LENGTH(REPLACE(REPLACE(c.value, '-', ''), ' ', '')) NOT IN (11, 12, 13);
```
- 注：手机11位，固话含区号12-13位

### 7. 数据充实缺口
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN business_scope IS NULL OR business_scope = '' THEN 1 END) as no_scope,
  COUNT(CASE WHEN district IS NULL OR district = '' THEN 1 END) as no_district,
  COUNT(CASE WHEN source = 'xlsx_import' AND business_scope IS NULL THEN 1 END) as xlsx_no_scope
FROM enterprises;
```
- business_scope 缺失率 >50% = P1
- xlsx 导入企业无 business_scope = P2（需要 Pass 2 充实）

### 8a. UBO 覆盖率
```sql
-- 检查实际控制人（UBO）数据覆盖
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN legal_representative IS NOT NULL AND legal_representative != '' THEN 1 END) as has_legal_rep,
  ROUND(COUNT(CASE WHEN legal_representative IS NOT NULL AND legal_representative != '' THEN 1 END) * 100.0 / COUNT(*), 1) as coverage_pct
FROM enterprises;
```
- legal_representative 覆盖率 <40% = P1（影响邮件个性化，无法称呼负责人）
- 高分企业（≥70分）缺 legal_representative = P1

### 8b. lead_status 分布
```sql
-- 检查各状态的企业分布（如有 lead_status 字段）
SELECT
  CASE
    WHEN id IN (SELECT enterprise_id FROM email_sends WHERE status = 'sent') THEN 'emailed'
    WHEN id IN (SELECT enterprise_id FROM email_sends WHERE status IN ('queued','approved')) THEN 'in-queue'
    WHEN industry_match_score >= 70 THEN 'qualified-not-contacted'
    WHEN industry_match_score > 0 THEN 'scored-low'
    ELSE 'unscored'
  END as lead_status,
  COUNT(*) as cnt
FROM enterprises
WHERE qualification NOT IN ('协会', '研究院')
GROUP BY lead_status
ORDER BY cnt DESC;
```
- qualified-not-contacted 为 0 = P1（所有高质量线索已接触，需要补充新线索）
- unscored > 20% = P1

### 9. 目标行业匹配
```sql
SELECT e.id, e.name, e.business_scope FROM enterprises e
WHERE e.business_scope IS NOT NULL
AND e.business_scope NOT LIKE '%制造%'
AND e.business_scope NOT LIKE '%信息技术%'
AND e.business_scope NOT LIKE '%装备%'
AND e.business_scope NOT LIKE '%汽车%'
AND e.business_scope NOT LIKE '%新能源%'
AND e.business_scope NOT LIKE '%新材料%'
AND e.business_scope NOT LIKE '%健康%'
AND e.business_scope NOT LIKE '%电子%'
AND e.business_scope NOT LIKE '%精密%'
AND e.business_scope NOT LIKE '%模具%'
AND e.business_scope NOT LIKE '%激光%'
AND e.business_scope NOT LIKE '%储能%'
LIMIT 10;
```
- 非目标行业企业占比 >20% = P2

## 输出格式

```json
[
  {
    "id": "lead-001",
    "priority": "P1",
    "category": "lead-quality",
    "title": "42家高分企业缺少邮箱",
    "description": "score >= 70 的企业中有42家没有邮箱联系方式，无法进入邮件管道",
    "fix_hint": "运行 Pass 2 充实这些企业的详情页数据，或用企业名搜索邮箱",
    "effort": "medium"
  }
]
```

## 注意事项

- 只读操作，不修改数据库
- 采样检查时取 20 条即可，不需要全表扫描
- 报告具体数字，不要只说"一些"或"很多"
- UBO 字段使用 `legal_representative` 列（当前 schema 无独立 ubo 列）
- lead_status 是派生字段，通过子查询计算，而非存储字段
