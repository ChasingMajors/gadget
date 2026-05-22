# CM Rarity Gadget MVP Trial Plan

## Trial Goal

Validate whether collectors understand and value a small Chasing Majors rarity badge on eBay and COMC listings before building the full paid data platform.

The MVP should answer:

- Does the badge placement feel useful without disrupting shopping?
- Do rarity tier, scarcity score, print run, pack odds, and POP data create enough curiosity to click?
- Are marketplace titles good enough for reliable card matching?
- Which fields are most often missing or ambiguous?
- Does the upgrade prompt feel natural for free users?

## Current Extension State

- eBay and COMC content scripts inject a `CM` badge onto listing images.
- The hover/click panel renders the full API response shape.
- API calls are routed through `background.js`, which is the right place for future auth, CORS handling, rate limits, and telemetry.
- Fallback data remains available when the API is unreachable.
- `MVP_ADMIN_MODE` is enabled so internal trials show all returned API fields.

## Required Hosted API

The extension expects:

```txt
GET /rarity?q={encoded card title}&source={ebay|comc}&url={current page url}
```

Response:

```json
{
  "title": "Matched card title",
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

## Product Bottlenecks

1. Card matching quality
   Marketplace titles mix true card identity with grading, condition, shipping terms, hype words, and seller mistakes. The backend needs confidence scoring and a clear fallback when it cannot identify a card.

2. Rarity data coverage
   A compelling MVP does not need every card, but it does need enough coverage for a narrow trial segment. Pick one sport/year/product lane first.

3. Missing field strategy
   Some cards will have print run but not pack odds, or POP counts but no exact scarcity model. The API should return `null` for unknown fields and use `lockedFields` only for entitlement.

4. Admin versus paid entitlement
   `MVP_ADMIN_MODE` is fine for internal testing. Real production needs the backend to decide access from a token rather than trusting extension config.

5. Performance and rate limits
   Search pages can contain many listings. The backend should cache by normalized title/source and the extension should avoid aggressive lookup bursts.

6. Chrome Web Store readiness
   Before submission, turn off `MVP_ADMIN_MODE`, add a privacy policy, avoid unnecessary host permissions, and confirm the extension does not imply affiliation with eBay or COMC.

## Recommended Trial Scope

Start with one narrow card universe:

- 2025-26 basketball prospects, or
- 2024-25 basketball inserts/parallels, or
- a curated 100-card internal demo set.

For each card, stage:

- canonical title
- aliases/searchable title patterns
- rarity tier
- scarcity score
- estimated print run
- pack odds
- POP total
- POP gem

## Setup Sequence

1. Deploy a hosted staging API at `https://api.chasingmajors.com/rarity` or a staging subdomain.
2. Seed a narrow curated dataset.
3. Return real values for matched cards and `Unknown` or low confidence for misses.
4. Reload the unpacked extension in Chrome.
5. Test on real eBay and COMC pages.
6. Log which titles fail to match, which fields are missing, and where the panel feels intrusive.

## Production Prep After MVP

- Replace `MVP_ADMIN_MODE` with real login/token state.
- Move lookup counting to the backend.
- Add request signing or a session token.
- Add telemetry for impressions, opens, match confidence, and upgrade clicks.
- Add a packaging script for Chrome Web Store zip builds.
