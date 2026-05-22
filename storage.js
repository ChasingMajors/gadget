(function () {
  const STORAGE_KEYS = Object.freeze({
    USER_STATE: "cmRarityUserState",
    DAILY_USAGE: "cmRarityDailyUsage"
  });

  const DEFAULT_USER_STATE = Object.freeze({
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
    const stored = await getChromeStorage([STORAGE_KEYS.USER_STATE]);
    return {
      ...DEFAULT_USER_STATE,
      ...(stored[STORAGE_KEYS.USER_STATE] || {})
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
    const [userState, dailyUsage] = await Promise.all([
      getUserState(),
      getDailyUsage()
    ]);
    const config = window.CM_RARITY_CONFIG;
    const isPaid = userState.plan === "paid";
    const remainingFreeLookups = Math.max(0, config.FREE_DAILY_LIMIT - dailyUsage.count);

    return {
      userState,
      dailyUsage,
      isPaid,
      isLoggedIn: userState.status === "logged_in",
      remainingFreeLookups,
      hasFreeLookup: remainingFreeLookups > 0
    };
  }

  window.CMRarityStorage = {
    getAccessState,
    getDailyUsage,
    getUserState,
    incrementDailyUsage,
    setUserState,
    STORAGE_KEYS
  };
})();
