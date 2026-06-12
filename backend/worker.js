import cards from "./data/cards.json";
import { buildRarityResponse } from "./worker-matcher.js";

const UPGRADE_URL = "https://chasingmajors.com/upgrade";
const APP_URL = "https://chasingmajors.com";
const PAID_FIELDS = new Set(["printRun", "packOdds"]);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type, Authorization",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

function redirect(url, status = 303) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Location": url
    }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${value}`;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function planFromStatus(status) {
  return ["active", "trialing"].includes(status) ? "paid" : "free";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function db(env) {
  return env.CM_DB || null;
}

async function upsertUser(env, user) {
  const database = db(env);
  if (!database || !user.email) {
    return null;
  }

  const existing = await database.prepare("SELECT * FROM users WHERE email = ?")
    .bind(user.email)
    .first();
  const id = existing?.id || randomId("usr");
  const timestamp = nowIso();
  const plan = user.plan || planFromStatus(user.subscription_status || "free");

  await database.prepare(`
    INSERT INTO users (
      id, email, stripe_customer_id, stripe_subscription_id, subscription_status, plan, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      stripe_customer_id = COALESCE(excluded.stripe_customer_id, users.stripe_customer_id),
      stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, users.stripe_subscription_id),
      subscription_status = excluded.subscription_status,
      plan = excluded.plan,
      updated_at = excluded.updated_at
  `)
    .bind(
      id,
      user.email,
      user.stripe_customer_id || existing?.stripe_customer_id || null,
      user.stripe_subscription_id || existing?.stripe_subscription_id || null,
      user.subscription_status || existing?.subscription_status || "free",
      plan,
      existing?.created_at || timestamp,
      timestamp
    )
    .run();

  return database.prepare("SELECT * FROM users WHERE email = ?").bind(user.email).first();
}

async function updateUserSubscription(env, user) {
  const database = db(env);
  const timestamp = nowIso();
  const plan = planFromStatus(user.subscription_status || "free");

  if (!database || !user.stripe_customer_id) {
    return null;
  }

  const existing = await database.prepare("SELECT * FROM users WHERE stripe_customer_id = ?")
    .bind(user.stripe_customer_id)
    .first();

  if (!existing && user.email) {
    return upsertUser(env, {
      ...user,
      plan
    });
  }

  if (!existing) {
    return null;
  }

  await database.prepare(`
    UPDATE users
    SET stripe_subscription_id = COALESCE(?, stripe_subscription_id),
      subscription_status = ?,
      plan = ?,
      updated_at = ?
    WHERE stripe_customer_id = ?
  `)
    .bind(
      user.stripe_subscription_id || null,
      user.subscription_status || "free",
      plan,
      timestamp,
      user.stripe_customer_id
    )
    .run();

  return database.prepare("SELECT * FROM users WHERE stripe_customer_id = ?")
    .bind(user.stripe_customer_id)
    .first();
}

async function createSession(env, userId) {
  const database = db(env);
  if (!database || !userId) {
    return null;
  }

  const token = randomId("cm_live");
  const tokenHash = await sha256(token);
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await database.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `)
    .bind(randomId("ses"), userId, tokenHash, timestamp, expiresAt)
    .run();

  return token;
}

async function accountFromToken(env, token) {
  const database = db(env);
  if (!database || !token) {
    return null;
  }

  const tokenHash = await sha256(token);
  const row = await database.prepare(`
    SELECT users.email, users.plan, users.subscription_status, users.stripe_customer_id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `)
    .bind(tokenHash, nowIso())
    .first();

  if (!row) {
    return null;
  }

  return {
    status: "logged_in",
    plan: row.plan || planFromStatus(row.subscription_status),
    email: row.email || "",
    stripeCustomerId: row.stripe_customer_id || ""
  };
}

function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function adminSecret(request) {
  return request.headers.get("X-CM-Admin-Secret") || "";
}

function canUseAdminTools(request, env) {
  return Boolean(env.CM_ADMIN_SECRET) && constantTimeEqual(adminSecret(request), env.CM_ADMIN_SECRET);
}

async function accountFromRequest(request, env = {}) {
  const token = bearerToken(request);

  if (!token) {
    return {
      status: "anonymous",
      plan: "free",
      email: ""
    };
  }

  const account = await accountFromToken(env, token);
  if (account) {
    return account;
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

async function handleRarity(request, url, env) {
  const query = url.searchParams.get("q") || "";
  const source = url.searchParams.get("source") || "unknown";
  const pageUrl = url.searchParams.get("url") || "";

  if (!query.trim()) {
    return json({
      error: "Missing required q parameter"
    }, 400);
  }

  const account = await accountFromRequest(request, env);
  const rarity = buildRarityResponse({
    query,
    source,
    pageUrl,
    cards,
    upgradeUrl: UPGRADE_URL
  });

  return json(lockForAccess(rarity, account));
}

async function createCheckoutSession(request, env, options = {}) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return {
      error: "Stripe checkout is not configured"
    };
  }

  const account = await accountFromRequest(request, env);
  const body = options.body || {};
  const origin = new URL(request.url).origin;
  const email = String(body.email || account.email || "").trim().toLowerCase();
  const successUrl = `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/signup?checkout=cancel`;
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    allow_promotion_codes: "true",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: email || account.email || "cm-extension-beta"
  });

  if (email) {
    params.set("customer_email", email);
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
    return {
      error: checkout.error?.message || "Unable to create checkout session"
    };
  }

  return {
    url: checkout.url,
    id: checkout.id
  };
}

async function handleCheckout(request, env) {
  const body = await request.json().catch(() => ({}));
  const checkout = await createCheckoutSession(request, env, {
    body
  });

  if (checkout.error) {
    return json({
      error: checkout.error
    }, checkout.error === "Stripe checkout is not configured" ? 501 : 502);
  }

  return json(checkout);
}

async function handleCheckoutStart(request, env) {
  const url = new URL(request.url);
  const checkout = await createCheckoutSession(request, env, {
    body: {
      email: url.searchParams.get("email") || ""
    }
  });

  if (checkout.error) {
    return json({
      error: checkout.error
    }, checkout.error === "Stripe checkout is not configured" ? 501 : 502);
  }

  return redirect(checkout.url);
}

function signupPage(request, error = "") {
  const url = new URL(request.url);
  const email = escapeHtml(url.searchParams.get("email") || "");
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";

  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CM Rarity Gadget Signup</title>
  <style>
    body { background:#f8fafc; color:#111827; font-family:Arial, Helvetica, sans-serif; margin:0; }
    main { margin:48px auto; max-width:440px; padding:24px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:22px; }
    h1 { font-size:22px; margin:0 0 8px; }
    p { color:#475569; font-size:14px; line-height:1.5; }
    label { display:block; font-size:13px; font-weight:800; margin:18px 0 6px; }
    input { border:1px solid #cbd5e1; border-radius:7px; font-size:14px; padding:11px; width:100%; }
    button { background:#111827; border:0; border-radius:7px; color:white; cursor:pointer; font-size:14px; font-weight:800; margin-top:14px; min-height:42px; width:100%; }
    .error { color:#b91c1c; font-weight:700; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>CM Rarity Gadget</h1>
      <p>Create your account and start the $5/month plan. Beta promo codes can be entered in Stripe Checkout.</p>
      ${errorHtml}
      <form method="post" action="/signup">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value="${email}" autocomplete="email" required>
        <button type="submit">Continue to Stripe Checkout</button>
      </form>
    </section>
  </main>
</body>
</html>`);
}

async function handleSignupPost(request, env) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return signupPage(request, "Enter a valid email address.");
  }

  const checkout = await createCheckoutSession(request, env, {
    body: { email }
  });

  if (checkout.error) {
    return signupPage(request, checkout.error);
  }

  return redirect(checkout.url);
}

async function stripeGet(env, path) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
    }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Stripe request failed");
  }

  return data;
}

async function stripePost(env, path, params) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Stripe request failed");
  }

  return data;
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeWebhook(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, ...value] = part.split("=");
    return [key, value.join("=")];
  }));
  const timestamp = parts.t;
  const receivedSignature = parts.v1;

  if (!timestamp || !receivedSignature) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    return false;
  }

  const expectedSignature = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return constantTimeEqual(expectedSignature, receivedSignature);
}

async function customerEmail(env, customerId) {
  if (!customerId) {
    return "";
  }

  const customer = await stripeGet(env, `/customers/${encodeURIComponent(customerId)}`);
  return String(customer.email || "").toLowerCase();
}

async function syncSubscription(env, subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
  const email = await customerEmail(env, customerId).catch(() => "");

  return updateUserSubscription(env, {
    email,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id || "",
    subscription_status: subscription.status || "free"
  });
}

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "Stripe webhook is not configured" }, 501);
  }

  const payload = await request.text();
  const verified = await verifyStripeWebhook(payload, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);

  if (!verified) {
    return json({ error: "Invalid Stripe signature" }, 400);
  }

  const event = JSON.parse(payload);
  const object = event.data?.object || {};

  if (event.type === "checkout.session.completed") {
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : "";
    const subscription = subscriptionId ? await stripeGet(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`) : null;
    const status = subscription?.status || (object.payment_status === "paid" ? "active" : "free");

    await upsertUser(env, {
      email: String(object.customer_details?.email || object.customer_email || "").toLowerCase(),
      stripe_customer_id: typeof object.customer === "string" ? object.customer : "",
      stripe_subscription_id: subscriptionId,
      subscription_status: status
    });
  }

  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await syncSubscription(env, object);
  }

  return json({ received: true });
}

async function handleBillingPortal(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Stripe billing is not configured" }, 501);
  }

  const account = await accountFromRequest(request, env);
  if (!account.stripeCustomerId) {
    return json({ error: "No billing account found" }, 403);
  }

  const origin = new URL(request.url).origin;
  const portal = await stripePost(env, "/billing_portal/sessions", new URLSearchParams({
    customer: account.stripeCustomerId,
    return_url: `${origin}/login`
  }));

  return json({ url: portal.url });
}

async function handleAdminIssueToken(request, env) {
  if (!canUseAdminTools(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const database = db(env);
  if (!database) {
    return json({ error: "D1 database is not configured" }, 501);
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const plan = ["admin", "paid"].includes(body.plan) ? body.plan : "admin";

  if (!email || !email.includes("@")) {
    return json({ error: "Valid email is required" }, 400);
  }

  const user = await upsertUser(env, {
    email,
    subscription_status: plan === "admin" ? "active" : "active",
    plan
  });
  const token = user ? await createSession(env, user.id) : "";

  if (!token) {
    return json({ error: "Unable to issue token" }, 500);
  }

  return json({
    email: user.email,
    plan: user.plan,
    token
  });
}

async function handleBillingSuccess(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId || !env.STRIPE_SECRET_KEY) {
    return html("<p>Checkout could not be verified.</p>", 400);
  }

  const session = await stripeGet(env, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : "";
  const subscription = subscriptionId ? await stripeGet(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`) : null;
  const email = String(session.customer_details?.email || session.customer_email || "").toLowerCase();
  const status = subscription?.status || (session.payment_status === "paid" ? "active" : "free");
  const user = await upsertUser(env, {
    email,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : "",
    stripe_subscription_id: subscriptionId,
    subscription_status: status
  });
  const token = user ? await createSession(env, user.id) : "";

  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CM Rarity Gadget Activated</title>
  <style>
    body { background:#f8fafc; color:#111827; font-family:Arial, Helvetica, sans-serif; margin:0; }
    main { margin:48px auto; max-width:560px; padding:24px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:22px; }
    h1 { font-size:22px; margin:0 0 8px; }
    p { color:#475569; font-size:14px; line-height:1.5; }
    code { background:#f1f5f9; border-radius:7px; display:block; margin:14px 0; overflow-wrap:anywhere; padding:12px; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>You're subscribed</h1>
      <p>Copy this access token, open the CM Rarity Gadget toolbar popup, paste it, and click Activate extension.</p>
      <code>${escapeHtml(token || "Token unavailable. Contact support.")}</code>
      <p>${escapeHtml(email)} is now ${escapeHtml(planFromStatus(status))}.</p>
    </section>
  </main>
</body>
</html>`);
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

    if (url.pathname === "/stripe/webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }

    if (url.pathname === "/admin/issue-token" && request.method === "POST") {
      return handleAdminIssueToken(request, env);
    }

    if (url.pathname === "/signup" && request.method === "GET") {
      return signupPage(request);
    }

    if (url.pathname === "/signup" && request.method === "POST") {
      return handleSignupPost(request, env);
    }

    if (url.pathname === "/login" && request.method === "GET") {
      return signupPage(request);
    }

    if (url.pathname === "/billing/success" && request.method === "GET") {
      return handleBillingSuccess(request, env);
    }

    if (url.pathname === "/me" && request.method === "GET") {
      return json(await accountFromRequest(request, env));
    }

    if (url.pathname === "/rarity") {
      return handleRarity(request, url, env);
    }

    if (url.pathname === "/billing/checkout" && request.method === "POST") {
      return handleCheckout(request, env);
    }

    if (url.pathname === "/billing/portal" && request.method === "POST") {
      return handleBillingPortal(request, env);
    }

    if (url.pathname === "/billing/start" && request.method === "GET") {
      return handleCheckoutStart(request, env);
    }

    return json({
      error: "Not found"
    }, 404);
  }
};
