# CM Rarity Gadget v4

Chrome extension scaffold for Chasing Majors rarity intelligence on eBay and COMC listings.

## Architecture

- `manifest.json`: Chrome Manifest V3 extension config.
- `background.js`: API proxy service worker for backend calls, future auth, and rate-limit handling.
- `config.js`: API and freemium settings.
- `content.js`: page scan orchestration and lookup flow.
- `parser.js`: source detection and listing/image extraction.
- `api.js`: backend-ready rarity API client with mock fallback when unavailable.
- `ui.js`: CM badge and hover/click panel rendering.
- `storage.js`: user state and daily free lookup tracking with `chrome.storage.local`.
- `styles.css`: isolated overlay styling.
- `backend/`: minimal hosted `/rarity` API for MVP trials.
- `PRV_IMPORT.md`: CSV import workflow for expanding the Worker dataset from PRV.

## API Contract

The extension calls:

```txt
GET /rarity?q={encoded card title}&source={ebay|comc}&url={current page url}
```

Expected response:

```json
{
  "title": "Card title",
  "matchConfidence": 0.92,
  "rarityTier": "Rare",
  "scarcityScore": 86,
  "printRun": 99,
  "packOdds": "1:144 packs",
  "popTotal": 24,
  "popGem": 8,
  "lockedFields": [],
  "upgradeUrl": "https://chasingmajors.com/upgrade",
  "matchMode": "card"
}
```

`matchMode` can be `card` for exact card-level data or `set` for product/set-level PRV estimates.

## User State

The current user state is stored in `chrome.storage.local` under `cmRarityUserState`:

```json
{
  "status": "anonymous",
  "plan": "free"
}
```

Supported states:

- Anonymous/free: `{ "status": "anonymous", "plan": "free" }`
- Logged in/free: `{ "status": "logged_in", "plan": "free" }`
- Paid: `{ "status": "logged_in", "plan": "paid" }`
- Admin MVP: `{ "status": "admin", "plan": "admin" }`

Admin MVP state is treated as full access for local trials. It does not add real paid rarity values to the extension bundle; it only shows every field returned by the API, or `Unknown` when fallback data has no value.

`config.js` currently has `MVP_ADMIN_MODE: true` so unpacked extension trials show the full field set before production auth is connected. Set it to `false` before Chrome Web Store submission.

`config.js` currently points `API_BASE_URL` at the MVP Cloudflare Worker:

```txt
https://cm-rarity-api.johndownard.workers.dev
```

Before production submission, point `API_BASE_URL` to `https://api.chasingmajors.com`.

`API_CACHE_TTL_MS` is currently `0` so MVP data corrections appear immediately while testing.

## Chrome Web Store Notes

This scaffold avoids bundled paid rarity data. Free users only see limited fields, paid users can see all fields returned by the backend when they are not marked locked by `lockedFields`.

## Local Harness

Open `dev/harness.html` in Chrome to test badge placement, fallback data, daily limits, and local free/paid user state without loading marketplace pages.

## Tester Updates

For MVP testers, GitHub is the update source. Each pushed extension change builds a ZIP in the **Package Chrome extension** GitHub Action.

Tester update flow:

1. Open the latest successful **Package Chrome extension** workflow run in GitHub.
2. Download the `cm-rarity-gadget-extension` artifact.
3. Unzip it into a stable local folder, such as `~/ChasingMajors/cm-rarity-gadget`.
4. Go to `chrome://extensions`.
5. Click **Load unpacked** the first time, or **Reload** after replacing files in the same folder.

Local ZIP build:

```bash
npm run package:extension
```

This creates `dist/cm-rarity-gadget-v4.0.0.zip`. Keep the unpacked extension folder path stable on each tester Mac so Chrome can reload updates without removing/re-adding the extension.

## Validation

Run:

```bash
npm run validate
npm run api:validate
npm run validate:worker
npm run validate:all
```

This checks the Manifest V3 wiring, required files, icon references, host permissions, MVP/admin config warnings, and seed API matching.

Before production or Chrome Web Store submission, turn `MVP_ADMIN_MODE` off.
