const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { buildRarityResponse } = require("./lib/matcher");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = process.env.CM_RARITY_DATA_FILE || path.join(__dirname, "data", "cards.json");
const UPGRADE_URL = process.env.CM_UPGRADE_URL || "https://chasingmajors.com/upgrade";
const APP_URL = process.env.CM_APP_URL || "https://chasingmajors.com";
const ALLOWED_ORIGIN = process.env.CM_ALLOWED_ORIGIN || "*";
const PAID_FIELDS = new Set(["printRun", "packOdds"]);

function loadCards() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, Authorization",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendRedirect(response, url, statusCode = 303) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Location": url
  });
  response.end();
}

function bearerToken(request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function accountFromRequest(request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      status: "anonymous",
      plan: "free",
      email: ""
    };
  }

  return {
    status: "logged_in",
    plan: "free",
    email: ""
  };
}

function lockForAccess(rarity, account) {
  if (account.plan === "paid" || account.plan === "admin") {
    return rarity;
  }

  const lockedFields = Array.from(new Set([
    ...(rarity.lockedFields || []),
    ...Array.from(PAID_FIELDS).filter((field) => rarity[field] !== null && rarity[field] !== undefined)
  ]));

  return {
    ...rarity,
    printRun: null,
    packOdds: null,
    lockedFields
  };
}

function readJsonBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        resolve({});
      }
    });
  });
}

async function createCheckoutSession(request, body = {}) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return {
      error: "Stripe checkout is not configured"
    };
  }

  const account = accountFromRequest(request);
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": process.env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    allow_promotion_codes: "true",
    success_url: body.successUrl || `${APP_URL}/?cm_checkout=success`,
    cancel_url: body.cancelUrl || `${APP_URL}/?cm_checkout=cancel`,
    client_reference_id: account.email || "cm-extension-beta"
  });

  if (account.email) {
    params.set("customer_email", account.email);
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const checkout = await stripeResponse.json();

  if (!stripeResponse.ok) {
    return {
      error: checkout.error?.message || "Unable to create checkout session"
    };
  }

  return {
    url: checkout.url,
    id: checkout.id
  };
}

async function handleCheckout(request, response) {
  const body = await readJsonBody(request);
  const checkout = await createCheckoutSession(request, body);

  if (checkout.error) {
    sendJson(response, checkout.error === "Stripe checkout is not configured" ? 501 : 502, {
      error: checkout.error
    });
    return;
  }

  sendJson(response, 200, checkout);
}

async function handleCheckoutStart(request, response) {
  const checkout = await createCheckoutSession(request);

  if (checkout.error) {
    sendJson(response, checkout.error === "Stripe checkout is not configured" ? 501 : 502, {
      error: checkout.error
    });
    return;
  }

  sendRedirect(response, checkout.url);
}

function handleRarity(request, response, url) {
  const query = url.searchParams.get("q") || "";
  const source = url.searchParams.get("source") || "unknown";
  const pageUrl = url.searchParams.get("url") || "";

  if (!query.trim()) {
    sendJson(response, 400, {
      error: "Missing required q parameter"
    });
    return;
  }

  const rarity = buildRarityResponse({
    query,
    source,
    pageUrl,
    cards: loadCards(),
    upgradeUrl: UPGRADE_URL
  });

  sendJson(response, 200, lockForAccess(rarity, accountFromRequest(request)));
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (!["GET", "POST"].includes(request.method)) {
      sendJson(response, 405, {
        error: "Method not allowed"
      });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "cm-rarity-api"
      });
      return;
    }

    if (url.pathname === "/me" && request.method === "GET") {
      sendJson(response, 200, accountFromRequest(request));
      return;
    }

    if (url.pathname === "/rarity") {
      handleRarity(request, response, url);
      return;
    }

    if (url.pathname === "/billing/checkout" && request.method === "POST") {
      handleCheckout(request, response);
      return;
    }

    if (url.pathname === "/billing/start" && request.method === "GET") {
      handleCheckoutStart(request, response);
      return;
    }

    sendJson(response, 404, {
      error: "Not found"
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`CM Rarity API listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  createServer
};
