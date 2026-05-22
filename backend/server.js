const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { buildRarityResponse } = require("./lib/matcher");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = process.env.CM_RARITY_DATA_FILE || path.join(__dirname, "data", "cards.json");
const UPGRADE_URL = process.env.CM_UPGRADE_URL || "https://chasingmajors.com/upgrade";
const ALLOWED_ORIGIN = process.env.CM_ALLOWED_ORIGIN || "*";

function loadCards() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, Authorization, X-CM-User-State",
    "Cache-Control": statusCode === 200 ? "public, max-age=300" : "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
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

  sendJson(response, 200, buildRarityResponse({
    query,
    source,
    pageUrl,
    cards: loadCards(),
    upgradeUrl: UPGRADE_URL
  }));
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.method !== "GET") {
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

    if (url.pathname === "/rarity") {
      handleRarity(request, response, url);
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
