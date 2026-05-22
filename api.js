(function () {
  const MOCK_RESPONSES = [
    {
      title: "Matched card",
      matchConfidence: 0.82,
      rarityTier: "Short Print",
      scarcityScore: 74,
      printRun: null,
      packOdds: null,
      popTotal: null,
      popGem: null,
      lockedFields: ["printRun", "packOdds", "popTotal", "popGem"],
      upgradeUrl: `${window.CM_RARITY_CONFIG.APP_URL}/upgrade`
    },
    {
      title: "Matched card",
      matchConfidence: 0.9,
      rarityTier: "Rare",
      scarcityScore: 86,
      printRun: null,
      packOdds: null,
      popTotal: null,
      popGem: null,
      lockedFields: ["printRun", "packOdds", "popTotal", "popGem"],
      upgradeUrl: `${window.CM_RARITY_CONFIG.APP_URL}/upgrade`
    }
  ];

  const cache = new Map();

  function config() {
    return window.CM_RARITY_CONFIG;
  }

  function normalizedApiBase() {
    return config().API_BASE_URL.replace(/\/+$/, "");
  }

  function buildRarityUrl({ title, source, pageUrl }) {
    const params = new URLSearchParams({
      q: title,
      source,
      url: pageUrl
    });

    return `${normalizedApiBase()}/rarity?${params.toString()}`;
  }

  function fallbackResponse(title) {
    const seed = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const response = MOCK_RESPONSES[seed % MOCK_RESPONSES.length];

    return {
      ...response,
      title,
      isFallback: true
    };
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
      upgradeUrl: data.upgradeUrl || `${config().APP_URL}/upgrade`,
      isFallback: false
    };
  }

  function canUseBackgroundProxy() {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage);
  }

  function fetchViaBackground(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "CM_RARITY_LOOKUP",
        payload
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Rarity API unavailable"));
          return;
        }

        resolve(response.rarity);
      });
    });
  }

  async function fetchDirect(payload) {
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

    return sanitizeApiResponse(await response.json(), payload.title);
  }

  async function fetchRarity({ title, source, pageUrl }) {
    const cacheKey = `${source}:${title}:${pageUrl}`;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    try {
      const payload = { title, source, pageUrl };
      const rarity = canUseBackgroundProxy()
        ? await fetchViaBackground(payload)
        : await fetchDirect(payload);
      cache.set(cacheKey, rarity);
      return rarity;
    } catch (error) {
      const fallback = fallbackResponse(title);
      cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  window.CMRarityApi = {
    buildRarityUrl,
    fetchRarity
  };
})();
