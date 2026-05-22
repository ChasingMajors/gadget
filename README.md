# CM Rarity Gadget v4

Chrome extension scaffold for Chasing Majors rarity intelligence on eBay and COMC listings.

## Architecture

- `manifest.json`: Chrome Manifest V3 extension config.
- `config.js`: API and freemium settings.
- `content.js`: page scan orchestration and lookup flow.
- `parser.js`: source detection and listing/image extraction.
- `api.js`: backend-ready rarity API client with mock fallback when unavailable.
- `ui.js`: CM badge and hover/click panel rendering.
- `storage.js`: user state and daily free lookup tracking with `chrome.storage.local`.
- `styles.css`: isolated overlay styling.

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
  "upgradeUrl": "https://chasingmajors.com/upgrade"
}
```

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

## Chrome Web Store Notes

This scaffold avoids bundled paid rarity data. Free users only see limited fields, paid users can see all fields returned by the backend when they are not marked locked by `lockedFields`.

## Local Harness

Open `dev/harness.html` in Chrome to test badge placement, fallback data, daily limits, and local free/paid user state without loading marketplace pages.
