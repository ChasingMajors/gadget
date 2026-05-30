const fs = require("fs");

const required = [
  "wrangler.toml",
  "backend/worker.js",
  "backend/worker-matcher.js",
  "backend/schema.sql",
  "backend/data/cards.json"
];

const missing = required.filter((file) => !fs.existsSync(file));

if (missing.length) {
  console.error("Missing Cloudflare Worker files:");
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const worker = fs.readFileSync("backend/worker.js", "utf8");
const wrangler = fs.readFileSync("wrangler.toml", "utf8");

if (!worker.includes("export default")) {
  console.error("backend/worker.js must export a default Worker handler");
  process.exit(1);
}

[
  'url.pathname === "/me"',
  'url.pathname === "/billing/checkout"',
  'url.pathname === "/billing/start"',
  'url.pathname === "/billing/success"',
  'url.pathname === "/billing/portal"',
  'url.pathname === "/stripe/webhook"',
  'url.pathname === "/signup"',
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "lockForAccess",
  "CM_DB"
].forEach((snippet) => {
  if (!worker.includes(snippet)) {
    console.error(`backend/worker.js is missing beta auth/billing support: ${snippet}`);
    process.exit(1);
  }
});

if (!wrangler.includes('main = "backend/worker.js"')) {
  console.error("wrangler.toml must point main to backend/worker.js");
  process.exit(1);
}

console.log("Cloudflare Worker validation passed.");
