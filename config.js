(function () {
  const API_BASE_URL = "https://api.chasingmajors.com";

  const config = Object.freeze({
    API_BASE_URL,
    PRODUCTION_API_BASE_URL: "https://api.chasingmajors.com",
    FREE_DAILY_LIMIT: 5,
    APP_URL: "https://chasingmajors.com",
    LOGIN_URL: `${API_BASE_URL}/login`,
    SIGNUP_URL: `${API_BASE_URL}/signup`,
    BILLING_URL: `${API_BASE_URL}/billing/start?source=extension&intent=billing`,
    FEEDBACK_URL: "mailto:chasingmajors@gmail.com?subject=CM%20Rarity%20Gadget%20Beta%20Feedback",
    API_CACHE_TTL_MS: 0,
    AUTH_ENABLED: true
  });

  globalThis.CM_RARITY_CONFIG = config;

  if (typeof window !== "undefined") {
    window.CM_RARITY_CONFIG = config;
  }
})();
