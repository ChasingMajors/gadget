import cards from "./data/cards.json";
import { buildRarityResponse } from "./worker-matcher.js";

const UPGRADE_URL = "https://chasingmajors.com/upgrade";
const APP_URL = "https://app.chasingmajors.com";
const PAID_FIELDS = new Set(["printRun", "packOdds"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type, Authorization, X-CM-User-State",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function accountFromRequest(request, env = {}) {
  const token = bearerToken(request);
  const requestedState = request.headers.get("X-CM-User-State") || "";

  if (env.CM_ALLOW_CLIENT_ADMIN === "true" && requestedState === "admin") {
    return {
      status: "admin",
      plan: "admin",
      email: env.CM_BETA_PAID_EMAIL || ""
    };
  }

  if (!token) {
    return {
      status: "anonymous",
      plan: "free",
      email: ""
    };
  }

  if (env.CM_BETA_PAID_TOKEN && token === env.CM_BETA_PAID_TOKEN) {
    return {
      status: "logged_in",
      plan: "paid",
      email: env.CM_BETA_PAID_EMAIL || ""
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

function handleRarity(request, url, env) {
  const query = url.searchParams.get("q") || "";
  const source = url.searchParams.get("source") || "unknown";
  const pageUrl = url.searchParams.get("url") || "";

  if (!query.trim()) {
    return json({
      error: "Missing required q parameter"
    }, 400);
  }

  const account = accountFromRequest(request, env);
  const rarity = buildRarityResponse({
    query,
    source,
    pageUrl,
    cards,
    upgradeUrl: UPGRADE_URL
  });

  return json(lockForAccess(rarity, account));
}

async function handleCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return json({
      error: "Stripe checkout is not configured"
    }, 501);
  }

  const account = accountFromRequest(request, env);
  const body = await request.json().catch(() => ({}));
  const successUrl = body.successUrl || `${APP_URL}/billing/success`;
  const cancelUrl = body.cancelUrl || `${APP_URL}/billing`;
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    allow_promotion_codes: "true",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: account.email || "cm-extension-beta"
  });

  if (account.email) {
    params.set("customer_email", account.email);
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const checkout = await stripeResponse.json();

  if (!stripeResponse.ok) {
    return json({
      error: checkout.error?.message || "Unable to create checkout session"
    }, 502);
  }

  return json({
    url: checkout.url,
    id: checkout.id
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({}, 204);
    }

    if (!["GET", "POST"].includes(request.method)) {
      return json({
        error: "Method not allowed"
      }, 405);
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "cm-rarity-api"
      });
    }

    if (url.pathname === "/me" && request.method === "GET") {
      return json(accountFromRequest(request, env));
    }

    if (url.pathname === "/rarity") {
      return handleRarity(request, url, env);
    }

    if (url.pathname === "/billing/checkout" && request.method === "POST") {
      return handleCheckout(request, env);
    }

    return json({
      error: "Not found"
    }, 404);
  }
};
