(function () {
  const config = Object.freeze({
    API_BASE_URL: "https://cm-rarity-api.johndownard.workers.dev",
    PRODUCTION_API_BASE_URL: "https://api.chasingmajors.com",
    FREE_DAILY_LIMIT: 5,
    APP_URL: "https://chasingmajors.com",
    MVP_ADMIN_MODE: true
  });

  globalThis.CM_RARITY_CONFIG = config;

  if (typeof window !== "undefined") {
    window.CM_RARITY_CONFIG = config;
  }
})();
