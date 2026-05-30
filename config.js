(function () {
  const config = Object.freeze({
    API_BASE_URL: "https://cm-rarity-api.johndownard.workers.dev",
    PRODUCTION_API_BASE_URL: "https://api.chasingmajors.com",
    FREE_DAILY_LIMIT: 5,
    APP_URL: "https://app.chasingmajors.com",
    LOGIN_URL: "https://app.chasingmajors.com/login",
    SIGNUP_URL: "https://app.chasingmajors.com/signup",
    BILLING_URL: "https://app.chasingmajors.com/billing",
    FEEDBACK_URL: "https://app.chasingmajors.com/feedback",
    API_CACHE_TTL_MS: 0,
    AUTH_ENABLED: true,
    MVP_ADMIN_MODE: false
  });

  globalThis.CM_RARITY_CONFIG = config;

  if (typeof window !== "undefined") {
    window.CM_RARITY_CONFIG = config;
  }
})();
