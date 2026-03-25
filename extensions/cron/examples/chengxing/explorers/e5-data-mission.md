# E5: Data (quality + scraper status)

## PROMPT

"Data quality scan + scraper status for ChengXing-Bot at /Users/kevinster/ChengXing-Bot:

1. Row counts: `sqlite3 data/chengxing.db 'SELECT \"projects\", COUNT(*) FROM projects UNION ALL SELECT \"government_prices\", COUNT(*) FROM government_prices UNION ALL SELECT \"market_prices\", COUNT(*) FROM market_prices UNION ALL SELECT \"inquiry_prices\", COUNT(*) FROM inquiry_prices'`
2. Government price month data: `sqlite3 data/chengxing.db 'SELECT month, COUNT(*) FROM government_prices GROUP BY month ORDER BY month'` — if all month=0, note as known limitation (yearly data only)
3. Government price freshness: `sqlite3 data/chengxing.db 'SELECT year, COUNT(*) FROM government_prices GROUP BY year ORDER BY year'`
4. Market price freshness: `sqlite3 data/chengxing.db 'SELECT MAX(period) FROM market_prices'`
5. Check if bulk scraper has new data: compare row count to last tick's count (from cron/logs/summary.jsonl)

**If government_prices < 10000 rows**: Flag as P1 — scraper needs to run. The API has 48 monthly periods with 1K+ records each. Run `npx tsx src/scraper/xinxijia-bulk.ts 2>&1 | tail -20` to attempt bulk import.

Report: data scorecard, row counts, scraper status, any new issues."

## RETIREMENT CRITERIA

Never retired.
