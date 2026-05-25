# PRV Import Workflow

Use this when Google Sheets has the PRV data and the Worker needs broader coverage.

## Sheet Columns

Export a CSV with these preferred columns:

```txt
year,brand,product,player,cardNumber,team,parallel,serial,rarityTier,scarcityScore,prv,packOdds,popTotal,popGem,aliases
```

Minimum useful columns:

```txt
year,brand,product,player,cardNumber,prv
```

If Command Center/CM Sentinel only has a full card title and PRV, this is also supported:

```txt
title,prv,rarityTier,scarcityScore,packOdds,popTotal,popGem,aliases
```

The current Command Center set-level schema is also supported:

```txt
Code,DisplayName,Keywords,year,sport,manufacturer,product,setType,setLine,parallel,printRun,serial,subSetSize,packOdds
```

Rows from that schema are imported with `matchMode: "set"`, meaning marketplace listings can match the product/set when individual player-card rows are not available yet.
`Code` is preserved as product-level metadata, while the generated internal card `id` is based on the full imported title so parallel rows stay unique.

Aliases can be separated with `|` or `;`.

## Import

```bash
node scripts/import-prv-csv.js path/to/prv.csv backend/data/cards.json
node scripts/validate-api.js
node scripts/validate-worker.js
```

Then commit, push, and wait for Cloudflare to redeploy.

## Automated Sync

For low-manual operation, publish or expose the PRV sheet as CSV and save the URL in GitHub Actions as:

```txt
CM_PRV_CSV_URL
```

Then run the GitHub Action:

```txt
Sync PRV data
```

The action downloads the CSV, runs the importer, validates the generated Worker dataset, and commits `backend/data/cards.json` back to `main`. Cloudflare then redeploys from GitHub.

If the sync fails, the action logs the detected CSV headers and a small first-row sample so we can map the source sheet without exposing the secret URL.

Local equivalent:

```bash
CM_PRV_CSV_URL="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0" node scripts/sync-prv-from-url.js
```

## Trial Loop

1. Search eBay for a player/product.
2. Click CM badges.
3. If the card is `Unknown`, add or fix the PRV row.
4. Export CSV.
5. Import and redeploy.

The goal is not broad coverage immediately. The goal is a repeatable data path from PRV to the live Worker.
