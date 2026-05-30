importScripts("config.js");

const cache = new Map();

function cacheTtlMs() {
  return Number(globalThis.CM_RARITY_CONFIG.API_CACHE_TTL_MS || 0);
}

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

function buildApiUrl(path) {
  return `${normalizedApiBase()}${path}`;
}

function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["cmRaritySession"], (stored) => {
      resolve({
        token: "",
        email: "",
        status: "anonymous",
        plan: "free",
        ...(stored.cmRaritySession || {})
      });
    });
  });
}

function setSession(session) {
  const nextSession = {
    token: "",
    email: "",
    status: "anonymous",
    plan: "free",
    ...session
  };

  return new Promise((resolve) => {
    chrome.storage.local.set({
      cmRaritySession: nextSession,
      cmRarityUserState: {
        email: nextSession.email,
        status: nextSession.status,
        plan: nextSession.plan
      }
    }, () => resolve(nextSession));
  });
}

async function authHeaders() {
  const headers = {
    "Accept": "application/json"
  };
  const session = await getSession();

  if (session.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  if (globalThis.CM_RARITY_CONFIG.MVP_ADMIN_MODE) {
    headers["X-CM-User-State"] = "admin";
  }

  return headers;
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
    matchMode: data.matchMode || "card",
    isFallback: false
  };
}

async function fetchRarity(payload) {
  const cacheKey = `${payload.source}:${payload.title}:${payload.pageUrl}`;
  const ttl = cacheTtlMs();
  const cached = cache.get(cacheKey);

  if (ttl > 0 && cached && Date.now() - cached.timestamp < ttl) {
    return cached.rarity;
  }

  const response = await fetch(buildRarityUrl(payload), {
    method: "GET",
    headers: await authHeaders(),
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Rarity API returned ${response.status}`);
  }

  const rarity = sanitizeApiResponse(await response.json(), payload.title);
  if (ttl > 0) {
    cache.set(cacheKey, {
      rarity,
      timestamp: Date.now()
    });
  }
  return rarity;
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

  const account = await response.json();
  return setSession({
    token: (await getSession()).token,
    email: account.email || "",
    status: account.status || "anonymous",
    plan: account.plan || "free"
  });
}

async function startCheckout(payload = {}) {
  const response = await fetch(buildApiUrl("/billing/checkout"), {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Checkout API returned ${response.status}`);
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CM_RARITY_LOOKUP") {
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
  }

  if (message?.type === "CM_RARITY_SESSION_REFRESH") {
    fetchSession()
      .then((session) => sendResponse({
        ok: true,
        session
      }))
      .catch((error) => sendResponse({
        ok: false,
        error: error.message || "Session API unavailable"
      }));

    return true;
  }

  if (message?.type === "CM_RARITY_START_CHECKOUT") {
    startCheckout(message.payload)
      .then((checkout) => sendResponse({
        ok: true,
        checkout
      }))
      .catch((error) => sendResponse({
        ok: false,
        error: error.message || "Checkout API unavailable"
      }));

    return true;
  }

  return false;
});
