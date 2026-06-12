(function () {
  const FIELD_LABELS = Object.freeze({
    rarityTier: "Product Type",
    scarcityScore: "Scarcity Score",
    printRun: "Est. Print Run",
    packOdds: "Pack Odds"
  });

  const FREE_FIELDS = new Set(["rarityTier", "scarcityScore"]);
  const PAID_FIELDS = new Set(["rarityTier", "scarcityScore", "printRun", "packOdds"]);

  function matchModeLabel(matchMode) {
    return matchMode === "set" ? "Product/Set Estimate" : "Exact Card Match";
  }

  function appUrl(path = "") {
    return (window.CM_RARITY_CONFIG.APP_URL || "https://app.chasingmajors.com").replace(/\/+$/, "") + path;
  }

  function configUrl(key, fallbackPath = "") {
    return window.CM_RARITY_CONFIG[key] || appUrl(fallbackPath);
  }

  function vaultUrl(rarity, listing) {
    const url = new URL("/vault", appUrl());
    const query = vaultQuery(rarity, listing);
    if (query) {
      url.searchParams.set("q", query);
    }
    return url.toString();
  }

  function vaultQuery(rarity, listing) {
    if (rarity.matchMode === "set" && rarity.title) {
      return rarity.title.split(" - ")[0].trim();
    }

    return rarity.title || listing.title;
  }

  function badgeIconUrl() {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("icons/cm-logo.png");
    }
    return "";
  }

  function createBrandLogo(className) {
    const iconUrl = badgeIconUrl();
    if (!iconUrl) {
      const fallback = document.createElement("strong");
      fallback.className = className;
      fallback.textContent = "Chasing Majors";
      return fallback;
    }

    const logo = document.createElement("img");
    logo.className = className;
    logo.src = iconUrl;
    logo.alt = "Chasing Majors";
    logo.decoding = "async";
    logo.loading = "eager";
    return logo;
  }

  function formatValue(field, value) {
    if (value === null || value === undefined || value === "") {
      return "Unknown";
    }

    if (field === "scarcityScore") {
      return `${value}/100`;
    }

    if (typeof value === "number") {
      return value.toLocaleString();
    }

    return String(value);
  }

  function canShowField(field, rarity, accessState) {
    if (accessState.isPaid) {
      return PAID_FIELDS.has(field);
    }

    return FREE_FIELDS.has(field) && !rarity.lockedFields.includes(field);
  }

  function createFieldRow(field, rarity, accessState) {
    const row = document.createElement("div");
    row.className = "cm-rarity-row";

    const label = document.createElement("span");
    label.className = "cm-rarity-label";
    label.textContent = FIELD_LABELS[field];

    const value = document.createElement("span");
    value.className = "cm-rarity-value";

    if (canShowField(field, rarity, accessState)) {
      value.textContent = formatValue(field, rarity[field]);
    } else {
      row.classList.add("cm-rarity-row-locked");
      value.textContent = "Locked";
    }

    row.append(label, value);
    return row;
  }

  function createPanelShell() {
    const panel = document.createElement("aside");
    panel.className = "cm-rarity-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chasing Majors rarity intelligence");
    return panel;
  }

  function positionPanel(panel, badge, options = {}) {
    const margin = 12;
    const gap = 8;
    const badgeRect = badge.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const width = panelRect.width || 300;
    const height = panelRect.height || 220;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    let left = options.align === "center"
      ? badgeRect.left + (badgeRect.width / 2) - (width / 2)
      : badgeRect.right - width;
    let top = badgeRect.top - height - gap;

    if (top < margin) {
      top = badgeRect.bottom + gap;
    }

    left = Math.max(margin, Math.min(left, viewportWidth - width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - height - margin));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function renderPanel(panel, listing, rarity, accessState) {
    const fields = ["rarityTier", "scarcityScore", "printRun", "packOdds"];
    const upgradeUrl = rarity.upgradeUrl || configUrl("SIGNUP_URL", "/signup");
    const hasLockedFields = !accessState.isPaid && fields.some((field) => !canShowField(field, rarity, accessState));

    panel.textContent = "";

    const header = document.createElement("div");
    header.className = "cm-rarity-panel-header";

    const title = createBrandLogo("cm-rarity-panel-logo");

    const confidence = document.createElement("span");
    confidence.className = "cm-rarity-confidence";
    confidence.textContent = `${Math.round((rarity.matchConfidence || 0) * 100)}% match`;

    header.append(title, confidence);

    const matchedTitle = document.createElement("p");
    matchedTitle.className = "cm-rarity-matched-title";

    const recognitionLabel = document.createElement("strong");
    recognitionLabel.textContent = rarity.matchMode === "set" ? "Set recognition: " : "Card recognition: ";
    matchedTitle.append(recognitionLabel, rarity.title || listing.title || "Unknown");

    const matchMode = document.createElement("div");
    matchMode.className = `cm-rarity-match-mode cm-rarity-match-mode-${rarity.matchMode || "card"}`;
    matchMode.textContent = matchModeLabel(rarity.matchMode);

    const rows = document.createElement("div");
    rows.className = "cm-rarity-rows";
    fields.forEach((field) => rows.append(createFieldRow(field, rarity, accessState)));

    const actions = document.createElement("div");
    actions.className = "cm-rarity-actions";

    if (hasLockedFields) {
      const upgrade = document.createElement("a");
      upgrade.className = "cm-rarity-upgrade";
      upgrade.href = accessState.userState.status === "anonymous"
        ? configUrl("SIGNUP_URL", "/signup")
        : upgradeUrl;
      upgrade.target = "_blank";
      upgrade.rel = "noopener noreferrer";
      upgrade.textContent = accessState.userState.status === "anonymous"
        ? "Create account for full rarity data"
        : "Start $5/mo plan";
      actions.append(upgrade);
    }

    const openApp = document.createElement("a");
    openApp.className = "cm-rarity-open";
    openApp.href = vaultUrl(rarity, listing);
    openApp.target = "_blank";
    openApp.rel = "noopener noreferrer";
    openApp.textContent = "Open CM Vault";
    actions.append(openApp);

    const feedback = document.createElement("a");
    feedback.className = "cm-rarity-feedback";
    feedback.href = configUrl("FEEDBACK_URL", "/feedback");
    feedback.target = "_blank";
    feedback.rel = "noopener noreferrer";
    feedback.textContent = "Report issue";
    actions.append(feedback);

    if (rarity.isFallback) {
      const fallback = document.createElement("p");
      fallback.className = "cm-rarity-note";
      fallback.textContent = "CM rarity service is unavailable. No rarity estimate is being shown.";
      panel.append(header, matchedTitle, matchMode, rows, actions, fallback);
      return;
    }

    panel.append(header, matchedTitle, matchMode, rows, actions);
  }

  function renderLimitPanel(panel, accessState) {
    panel.textContent = "";

    const title = createBrandLogo("cm-rarity-panel-logo");

    const message = document.createElement("p");
    message.className = "cm-rarity-card-title";
    message.textContent = `Daily free limit reached. Free users get ${window.CM_RARITY_CONFIG.FREE_DAILY_LIMIT} rarity lookups per day.`;

    const actions = document.createElement("div");
    actions.className = "cm-rarity-actions";

    const upgrade = document.createElement("a");
    upgrade.className = "cm-rarity-upgrade";
    upgrade.href = accessState.userState.status === "anonymous"
      ? configUrl("SIGNUP_URL", "/signup")
      : configUrl("BILLING_URL", "/billing");
    upgrade.target = "_blank";
    upgrade.rel = "noopener noreferrer";
    upgrade.textContent = accessState.userState.status === "anonymous"
      ? "Create account"
      : "Start $5/mo plan";

    const openApp = document.createElement("a");
    openApp.className = "cm-rarity-open";
    openApp.href = appUrl("/vault");
    openApp.target = "_blank";
    openApp.rel = "noopener noreferrer";
    openApp.textContent = "Open CM Vault";

    const login = document.createElement("a");
    login.className = "cm-rarity-feedback";
    login.href = configUrl("LOGIN_URL", "/login");
    login.target = "_blank";
    login.rel = "noopener noreferrer";
    login.textContent = "Already have an account?";

    actions.append(upgrade, openApp, login);
    panel.append(title, message, actions);
  }

  function attachBadge(listing, handlers, options = {}) {
    const wrapper = document.createElement("span");
    wrapper.className = options.master ? "cm-rarity-wrapper cm-rarity-master-wrapper" : "cm-rarity-wrapper";

    const badge = document.createElement("button");
    badge.className = options.master ? "cm-rarity-badge cm-rarity-master-badge" : "cm-rarity-badge";
    badge.type = "button";
    badge.setAttribute("aria-label", options.ariaLabel || "Show Chasing Majors rarity intelligence");

    const iconUrl = options.iconUrl || badgeIconUrl();
    if (iconUrl) {
      const icon = document.createElement("img");
      icon.className = "cm-rarity-badge-icon";
      icon.src = iconUrl;
      icon.alt = "";
      icon.decoding = "async";
      icon.loading = "eager";
      badge.append(icon);
    } else {
      badge.textContent = options.label || "CM";
    }

    const panel = createPanelShell();
    panel.hidden = true;

    wrapper.append(badge);
    document.body.append(panel);

    if (options.master) {
      document.body.append(wrapper);
    } else {
      const container = listing.container;
      const computed = window.getComputedStyle(container);
      if (computed.position === "static") {
        container.classList.add("cm-rarity-positioned");
      }

      container.append(wrapper);
    }

    let isPinned = false;

    async function showPanel() {
      panel.hidden = false;
      wrapper.classList.add("cm-rarity-active");
      positionPanel(panel, badge, options.panelPosition);
      await handlers.onOpen(panel);
      positionPanel(panel, badge, options.panelPosition);
    }

    function hidePanel() {
      if (isPinned) {
        return;
      }

      panel.hidden = true;
      wrapper.classList.remove("cm-rarity-active");
    }

    window.addEventListener("scroll", () => {
      if (!panel.hidden) {
        positionPanel(panel, badge, options.panelPosition);
      }
    }, true);
    window.addEventListener("resize", () => {
      if (!panel.hidden) {
        positionPanel(panel, badge, options.panelPosition);
      }
    });

    badge.addEventListener("mouseenter", showPanel);
    badge.addEventListener("focus", showPanel);
    badge.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      isPinned = !isPinned;

      if (isPinned) {
        await showPanel();
      } else {
        hidePanel();
      }
    });

    wrapper.addEventListener("mouseleave", hidePanel);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        isPinned = false;
        hidePanel();
      }
    });

    return {
      badge,
      wrapper,
      panel,
      renderPanel: (rarity, accessState) => renderPanel(panel, listing, rarity, accessState),
      renderLimitPanel: (accessState) => renderLimitPanel(panel, accessState)
    };
  }

  function renderLoading(panel) {
    panel.textContent = "";
    const loading = document.createElement("p");
    loading.className = "cm-rarity-loading";
    loading.textContent = "Loading rarity intelligence...";
    panel.append(loading);
  }

  function renderError(panel) {
    panel.textContent = "";
    const error = document.createElement("p");
    error.className = "cm-rarity-note";
    error.textContent = "Rarity intelligence is temporarily unavailable.";
    panel.append(error);
  }

  window.CMRarityUI = {
    attachBadge,
    renderError,
    renderLoading
  };
})();
