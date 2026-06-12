(function () {
  const status = document.getElementById("cm-status");
  const tokenInput = document.getElementById("cm-token");
  const saveToken = document.getElementById("cm-save-token");
  const message = document.getElementById("cm-message");
  const createAccount = document.getElementById("cm-create-account");
  const openBilling = document.getElementById("cm-open-billing");
  const disconnect = document.getElementById("cm-disconnect");
  const reportIssue = document.getElementById("cm-report-issue");

  function configUrl(key) {
    return window.CM_RARITY_CONFIG[key] || "https://chasingmajors.com";
  }

  function apiUrl(path) {
    return `${window.CM_RARITY_CONFIG.API_BASE_URL.replace(/\/+$/, "")}${path}`;
  }

  function openExternal(url) {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url });
      return;
    }

    window.open(url, "_blank", "noopener");
  }

  async function fetchAccount(token) {
    const response = await fetch(apiUrl("/me"), {
      headers: {
        "Accept": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error("Unable to verify token");
    }

    return response.json();
  }

  async function openBillingPortal(token) {
    const response = await fetch(apiUrl("/billing/portal"), {
      method: "POST",
      headers: {
        "Accept": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error("Unable to open billing");
    }

    return response.json();
  }

  function renderAccount(account) {
    const plan = account.plan || "free";
    const email = account.email ? ` ${account.email}` : "";
    status.textContent = plan === "paid" || plan === "admin"
      ? `Active ${plan} account.${email}`
      : "Free account. Paid rarity fields remain locked.";
    openBilling.disabled = false;
    disconnect.disabled = false;
  }

  function renderDisconnected() {
    tokenInput.value = "";
    status.textContent = "No account connected.";
    openBilling.disabled = false;
    disconnect.disabled = true;
  }

  async function refresh() {
    const session = await window.CMRarityStorage.getSession();
    tokenInput.value = session.token || "";

    if (!session.token) {
      renderDisconnected();
      return;
    }

    try {
      const account = await fetchAccount(session.token);
      await window.CMRarityStorage.setSession({
        token: session.token,
        email: account.email || session.email || "",
        status: account.status || "logged_in",
        plan: account.plan || "free"
      });
      renderAccount(account);
    } catch (error) {
      status.textContent = "Saved token could not be verified.";
      disconnect.disabled = false;
    }
  }

  createAccount.href = configUrl("SIGNUP_URL");
  reportIssue.href = configUrl("FEEDBACK_URL");

  openBilling.addEventListener("click", async () => {
    const session = await window.CMRarityStorage.getSession();

    if (!session.token) {
      openExternal(configUrl("BILLING_URL"));
      return;
    }

    message.textContent = "Opening billing...";

    try {
      const portal = await openBillingPortal(session.token);
      openExternal(portal.url || configUrl("BILLING_URL"));
      message.textContent = "";
    } catch (error) {
      openExternal(configUrl("BILLING_URL"));
      message.textContent = "Billing portal unavailable. Opening checkout.";
    }
  });

  saveToken.addEventListener("click", async () => {
    const token = tokenInput.value.trim();

    if (!token) {
      message.textContent = "Paste the token shown after checkout.";
      return;
    }

    message.textContent = "Verifying...";

    try {
      const account = await fetchAccount(token);
      await window.CMRarityStorage.setSession({
        token,
        email: account.email || "",
        status: account.status || "logged_in",
        plan: account.plan || "free"
      });
      renderAccount(account);
      message.textContent = "Extension activated.";
    } catch (error) {
      message.textContent = "Token was not accepted.";
    }
  });

  disconnect.addEventListener("click", async () => {
    await window.CMRarityStorage.clearSession();
    renderDisconnected();
    message.textContent = "Account disconnected.";
  });

  refresh();
})();
