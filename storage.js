(function () {
  const STORAGE_KEYS = Object.freeze({
    USER_STATE: "cmRarityUserState",
    DAILY_USAGE: "cmRarityDailyUsage",
    SESSION: "cmRaritySession"
  });

  const DEFAULT_USER_STATE = Object.freeze({
    status: "anonymous",
    plan: "free",
    email: ""
  });

  const DEFAULT_SESSION = Object.freeze({
    token: "",
    email: "",
    status: "anonymous",
    plan: "free"
  });

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getChromeStorage(keys) {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve({});
        return;
      }

      chrome.storage.local.get(keys, resolve);
    });
  }

  function setChromeStorage(values) {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve();
        return;
      }

      chrome.storage.local.set(values, resolve);
    });
  }

  async function getUserState() {
    const stored = await getChromeStorage([STORAGE_KEYS.USER_STATE, STORAGE_KEYS.SESSION]);
    const session = {
      ...DEFAULT_SESSION,
      ...(stored[STORAGE_KEYS.SESSION] || {})
    };

    return {
      ...DEFAULT_USER_STATE,
      ...(stored[STORAGE_KEYS.USER_STATE] || {}),
      email: session.email || stored[STORAGE_KEYS.USER_STATE]?.email || "",
      plan: session.plan || stored[STORAGE_KEYS.USER_STATE]?.plan || "free",
      status: session.status || stored[STORAGE_KEYS.USER_STATE]?.status || "anonymous"
    };
  }

  async function setUserState(userState) {
    const nextState = {
      ...DEFAULT_USER_STATE,
      ...userState
    };

    await setChromeStorage({
      [STORAGE_KEYS.USER_STATE]: nextState
    });

    return nextState;
  }

  async function getSession() {
    const stored = await getChromeStorage([STORAGE_KEYS.SESSION]);
    return {
      ...DEFAULT_SESSION,
      ...(stored[STORAGE_KEYS.SESSION] || {})
    };
  }

  async function setSession(session) {
    const nextSession = {
      ...DEFAULT_SESSION,
      ...session
    };

    await setChromeStorage({
      [STORAGE_KEYS.SESSION]: nextSession,
      [STORAGE_KEYS.USER_STATE]: {
        status: nextSession.status,
        plan: nextSession.plan,
        email: nextSession.email
      }
    });

    return nextSession;
  }

  async function clearSession() {
    return setSession(DEFAULT_SESSION);
  }

  async function getDailyUsage() {
    const stored = await getChromeStorage([STORAGE_KEYS.DAILY_USAGE]);
    const current = stored[STORAGE_KEYS.DAILY_USAGE];
    const date = todayKey();

    if (!current || current.date !== date) {
      return {
        date,
        count: 0
      };
    }

    return current;
  }

  async function incrementDailyUsage() {
    const usage = await getDailyUsage();
    const nextUsage = {
      ...usage,
      count: usage.count + 1
    };

    await setChromeStorage({
      [STORAGE_KEYS.DAILY_USAGE]: nextUsage
    });

    return nextUsage;
  }

  async function getAccessState() {
    const [userState, dailyUsage, session] = await Promise.all([
      getUserState(),
      getDailyUsage(),
      getSession()
    ]);
    const config = window.CM_RARITY_CONFIG;
    const isAdmin = Boolean(config.MVP_ADMIN_MODE) || userState.plan === "admin" || userState.status === "admin";
    const isPaid = userState.plan === "paid" || isAdmin;
    const remainingFreeLookups = Math.max(0, config.FREE_DAILY_LIMIT - dailyUsage.count);

    return {
      userState,
      session,
      dailyUsage,
      isAdmin,
      isPaid,
      isLoggedIn: userState.status === "logged_in" || isAdmin,
      remainingFreeLookups,
      hasFreeLookup: remainingFreeLookups > 0
    };
  }

  window.CMRarityStorage = {
    getAccessState,
    getDailyUsage,
    getSession,
    getUserState,
    incrementDailyUsage,
    clearSession,
    setSession,
    setUserState,
    STORAGE_KEYS
  };
})();
