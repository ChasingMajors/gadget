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
      upgradeUrl: `${window.CM_RARITY_CONFIG.APP_URL}/upgrade`,
      matchMode: "card"
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
      upgradeUrl: `${window.CM_RARITY_CONFIG.APP_URL}/upgrade`,
      matchMode: "set"
    }
  ];

  const cache = new Map();

  function config() {
    return window.CM_RARITY_CONFIG;
  }

  function cacheTtlMs() {
    return Number(config().API_CACHE_TTL_MS || 0);
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

  function buildApiUrl(path) {
    return `${normalizedApiBase()}${path}`;
  }

  function accountUrl(path, params = {}) {
    const base = (config().APP_URL || "https://app.chasingmajors.com").replace(/\/+$/, "");
    const url = new URL(path, `${base}/`);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }

  async function authHeaders() {
    const headers = {
      "Accept": "application/json"
    };
    const session = await window.CMRarityStorage?.getSession?.();

    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    if (config().MVP_ADMIN_MODE) {
      headers["X-CM-User-State"] = "admin";
    }

    return headers;
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
      matchMode: data.matchMode || "card",
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
      headers: await authHeaders(),
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Rarity API returned ${response.status}`);
    }

    return sanitizeApiResponse(await response.json(), payload.title);
  }

  async function fetchSession() {
    const response = await fetch(buildApiUrl("/me"), {
      method: "GET",
      headers: await authHeaders(),
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Session API returned ${response.status}`);
    }

    return response.json();
  }

  async function startCheckout() {
    const response = await fetch(buildApiUrl("/billing/checkout"), {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        successUrl: accountUrl("/billing/success"),
        cancelUrl: accountUrl("/billing")
      }),
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Checkout API returned ${response.status}`);
    }

    return response.json();
  }

  async function fetchRarity({ title, source, pageUrl }) {
    const cacheKey = `${source}:${title}:${pageUrl}`;
    const ttl = cacheTtlMs();
    const cached = cache.get(cacheKey);

    if (ttl > 0 && cached && Date.now() - cached.timestamp < ttl) {
      return cached.rarity;
    }

    try {
      const payload = { title, source, pageUrl };
      const rarity = canUseBackgroundProxy()
        ? await fetchViaBackground(payload)
        : await fetchDirect(payload);
      if (ttl > 0) {
        cache.set(cacheKey, {
          rarity,
          timestamp: Date.now()
        });
      }
      return rarity;
    } catch (error) {
      const fallback = fallbackResponse(title);
      if (ttl > 0) {
        cache.set(cacheKey, {
          rarity: fallback,
          timestamp: Date.now()
        });
      }
      return fallback;
    }
  }

  window.CMRarityApi = {
    accountUrl,
    buildRarityUrl,
    fetchRarity,
    fetchSession,
    startCheckout
  };
})();
