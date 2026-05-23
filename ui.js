(function () {
  const FIELD_LABELS = Object.freeze({
    rarityTier: "Product Type",
    scarcityScore: "Scarcity score",
    printRun: "Est. print run",
    packOdds: "Pack odds"
  });

  const FREE_FIELDS = new Set(["rarityTier", "scarcityScore"]);
  const PAID_FIELDS = new Set(["rarityTier", "scarcityScore", "printRun", "packOdds"]);

  function matchModeLabel(matchMode) {
    return matchMode === "set" ? "Product/set estimate" : "Exact card match";
  }

  function appUrl(path = "") {
    return (window.CM_RARITY_CONFIG.APP_URL || "https://app.chasingmajors.com").replace(/\/+$/, "") + path;
  }

  function vaultUrl(rarity, listing) {
    const url = new URL("/vault", appUrl());
    const query = rarity.title || listing.title;
    if (query) {
      url.searchParams.set("q", query);
    }
    return url.toString();
  }

  function badgeIconUrl() {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("icons/cm-logo.png");
    }
    return "";
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
    const upgradeUrl = rarity.upgradeUrl || `${window.CM_RARITY_CONFIG.APP_URL}/upgrade`;
    const hasLockedFields = !accessState.isPaid && fields.some((field) => !canShowField(field, rarity, accessState));

    panel.textContent = "";

    const header = document.createElement("div");
    header.className = "cm-rarity-panel-header";

    const title = document.createElement("strong");
    title.className = "cm-rarity-title";
    title.textContent = "Chasing Majors";

    const confidence = document.createElement("span");
    confidence.className = "cm-rarity-confidence";
    confidence.textContent = `${Math.round((rarity.matchConfidence || 0) * 100)}% match`;

    header.append(title, confidence);

    const listingTitle = document.createElement("p");
    listingTitle.className = "cm-rarity-card-title";
    listingTitle.textContent = listing.title;

    const matchedTitle = document.createElement("p");
    matchedTitle.className = "cm-rarity-matched-title";
    matchedTitle.textContent = rarity.matchMode === "set"
      ? `CM Details: ${rarity.title || "Unknown"}`
      : `CM Details: ${rarity.title || listing.title}`;

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
      upgrade.href = upgradeUrl;
      upgrade.target = "_blank";
      upgrade.rel = "noopener noreferrer";
      upgrade.textContent = accessState.userState.status === "anonymous"
        ? "Sign in to unlock more rarity data"
        : "Upgrade to unlock full rarity data";
      actions.append(upgrade);
    }

    const openApp = document.createElement("a");
    openApp.className = "cm-rarity-open";
    openApp.href = vaultUrl(rarity, listing);
    openApp.target = "_blank";
    openApp.rel = "noopener noreferrer";
    openApp.textContent = "Open CM Vault";
    actions.append(openApp);

    if (rarity.isFallback) {
      const fallback = document.createElement("p");
      fallback.className = "cm-rarity-note";
      fallback.textContent = "Showing limited fallback data while CM rarity service is unavailable.";
      panel.append(header, listingTitle, matchedTitle, matchMode, rows, actions, fallback);
      return;
    }

    panel.append(header, listingTitle, matchedTitle, matchMode, rows, actions);
  }

  function renderLimitPanel(panel, accessState) {
    panel.textContent = "";

    const title = document.createElement("strong");
    title.className = "cm-rarity-title";
    title.textContent = "Daily free limit reached";

    const message = document.createElement("p");
    message.className = "cm-rarity-card-title";
    message.textContent = `Free users get ${window.CM_RARITY_CONFIG.FREE_DAILY_LIMIT} rarity lookups per day.`;

    const actions = document.createElement("div");
    actions.className = "cm-rarity-actions";

    const upgrade = document.createElement("a");
    upgrade.className = "cm-rarity-upgrade";
    upgrade.href = `${window.CM_RARITY_CONFIG.APP_URL}/upgrade`;
    upgrade.target = "_blank";
    upgrade.rel = "noopener noreferrer";
    upgrade.textContent = accessState.userState.status === "anonymous"
      ? "Sign in to continue"
      : "Upgrade for unlimited rarity";

    const openApp = document.createElement("a");
    openApp.className = "cm-rarity-open";
    openApp.href = appUrl("/vault");
    openApp.target = "_blank";
    openApp.rel = "noopener noreferrer";
    openApp.textContent = "Open CM Vault";

    actions.append(upgrade, openApp);
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
