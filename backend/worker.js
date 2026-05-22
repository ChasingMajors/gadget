import cards from "./data/cards.json";
import { buildRarityResponse } from "./worker-matcher.js";

const UPGRADE_URL = "https://chasingmajors.com/upgrade";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type, Authorization, X-CM-User-State",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function handleRarity(url) {
  const query = url.searchParams.get("q") || "";
  const source = url.searchParams.get("source") || "unknown";
  const pageUrl = url.searchParams.get("url") || "";

  if (!query.trim()) {
    return json({
      error: "Missing required q parameter"
    }, 400);
  }

  return json(buildRarityResponse({
    query,
    source,
    pageUrl,
    cards,
    upgradeUrl: UPGRADE_URL
  }));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({}, 204);
    }

    if (request.method !== "GET") {
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

    if (url.pathname === "/rarity") {
      return handleRarity(url);
    }

    return json({
      error: "Not found"
    }, 404);
  }
};
