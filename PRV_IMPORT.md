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

## Trial Loop

1. Search eBay for a player/product.
2. Click CM badges.
3. If the card is `Unknown`, add or fix the PRV row.
4. Export CSV.
5. Import and redeploy.

The goal is not broad coverage immediately. The goal is a repeatable data path from PRV to the live Worker.
