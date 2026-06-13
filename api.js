(function () {
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
    const base = normalizedApiBase();
    const url = new URL(path, `${base}/`);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }

  function sessionCacheKey(session) {
    return session?.token
      ? `${session.plan}:${session.email}:${session.token.slice(-12)}`
      : "anonymous";
  }

  async function authHeaders(session) {
    const headers = {
      "Accept": "application/json"
    };
    const activeSession = session || await window.CMRarityStorage?.getSession?.();

    if (activeSession?.token) {
      headers.Authorization = `Bearer ${activeSession.token}`;
    }

    return headers;
  }

  function fallbackResponse(title) {
    return {
      title,
      matchConfidence: 0,
      rarityTier: "Unknown",
      scarcityScore: null,
      printRun: null,
      packOdds: null,
      popTotal: null,
      popGem: null,
      lockedFields: [],
      upgradeUrl: `${config().APP_URL}/upgrade`,
      matchMode: "card",
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
      body: JSON.stringify({}),
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Checkout API returned ${response.status}`);
    }

    return response.json();
  }

  async function fetchRarity({ title, source, pageUrl }) {
    const session = await window.CMRarityStorage?.getSession?.();
    const cacheKey = `${sessionCacheKey(session)}:${source}:${title}:${pageUrl}`;
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
