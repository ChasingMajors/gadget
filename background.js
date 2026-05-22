importScripts("config.js");

const cache = new Map();

function normalizedApiBase() {
  return globalThis.CM_RARITY_CONFIG.API_BASE_URL.replace(/\/+$/, "");
}

function buildRarityUrl({ title, source, pageUrl }) {
  const params = new URLSearchParams({
    q: title,
    source,
    url: pageUrl
  });

  return `${normalizedApiBase()}/rarity?${params.toString()}`;
}

function sanitizeApiResponse(data, title) {
  return {
    title: data.title || title,
    matchConfidence: Number(data.matchConfidence ?? 0),
    rarityTier: data.rarityTier || "Unknown",
    scarcityScore: data.scarcityScore ?? null,
    printRun: data.printRun ?? null,
    packOdds: data.packOdds ?? null,
    popTotal: data.popTotal ?? null,
    popGem: data.popGem ?? null,
    lockedFields: Array.isArray(data.lockedFields) ? data.lockedFields : [],
    upgradeUrl: data.upgradeUrl || `${globalThis.CM_RARITY_CONFIG.APP_URL}/upgrade`,
    isFallback: false
  };
}

async function fetchRarity(payload) {
  const cacheKey = `${payload.source}:${payload.title}:${payload.pageUrl}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const response = await fetch(buildRarityUrl(payload), {
    method: "GET",
    headers: {
      "Accept": "application/json"
    },
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Rarity API returned ${response.status}`);
  }

  const rarity = sanitizeApiResponse(await response.json(), payload.title);
  cache.set(cacheKey, rarity);
  return rarity;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CM_RARITY_LOOKUP") {
    return false;
  }

  fetchRarity(message.payload)
    .then((rarity) => sendResponse({
      ok: true,
      rarity
    }))
    .catch((error) => sendResponse({
      ok: false,
      error: error.message || "Rarity API unavailable"
    }));

  return true;
});
