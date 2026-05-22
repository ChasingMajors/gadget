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
