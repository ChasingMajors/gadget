const NOISE_TERMS = new Set([
  "psa",
  "bgs",
  "sgc",
  "cgc",
  "gem",
  "mint",
  "graded",
  "grade",
  "auto",
  "autograph",
  "rookie",
  "rc",
  "card",
  "cards",
  "lot",
  "pre",
  "owned",
  "read",
  "hot",
  "rare",
  "ssp",
  "sp",
  "🔥"
]);

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[#(),.:;!?'"[\]{}|\\]/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(title) {
  return normalizeTitle(title)
    .split(" ")
    .filter((token) => token.length > 1)
    .filter((token) => !NOISE_TERMS.has(token));
}

function tokenSet(title) {
  return new Set(tokenize(title));
}

function includesAlias(query, card) {
  const normalizedQuery = normalizeTitle(query);
  return [card.canonicalTitle, ...(card.aliases || [])]
    .map(normalizeTitle)
    .some((alias) => alias && normalizedQuery.includes(alias));
}

function hasRequiredTerms(queryTokens, card) {
  return (card.requiredTerms || []).every((term) => queryTokens.has(term));
}

function serialScore(normalizedQuery, card) {
  const serialTerms = card.serialTerms || [];
  if (!serialTerms.length) {
    return 0;
  }

  return serialTerms.some((term) => normalizedQuery.includes(String(term).toLowerCase())) ? 0.12 : -0.08;
}

function scoreCard(query, card) {
  const queryTokens = tokenSet(query);
  const normalizedQuery = normalizeTitle(query);
  const cardTokens = tokenSet([card.canonicalTitle, ...(card.aliases || [])].join(" "));
  const overlap = Array.from(cardTokens).filter((token) => queryTokens.has(token));
  const coverage = cardTokens.size ? overlap.length / cardTokens.size : 0;
  const requiredBoost = hasRequiredTerms(queryTokens, card) ? 0.22 : -0.2;
  const aliasBoost = includesAlias(query, card) ? 0.25 : 0;
  const score = coverage * 0.68 + requiredBoost + aliasBoost + serialScore(normalizedQuery, card);

  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

function findBestMatch(query, cards, minimumConfidence = 0.54) {
  const ranked = cards
    .map((card) => ({
      card,
      confidence: scoreCard(query, card)
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0];

  if (!best || best.confidence < minimumConfidence) {
    return {
      card: null,
      confidence: best?.confidence || 0
    };
  }

  return best;
}

function buildRarityResponse({ query, source, pageUrl, cards, upgradeUrl }) {
  const match = findBestMatch(query, cards);

  if (!match.card) {
    return {
      title: query || "Unknown card",
      matchConfidence: match.confidence,
      rarityTier: "Unknown",
      scarcityScore: null,
      printRun: null,
      packOdds: null,
      popTotal: null,
      popGem: null,
      lockedFields: [],
      upgradeUrl
    };
  }

  return {
    title: match.card.canonicalTitle,
    matchConfidence: match.confidence,
    rarityTier: match.card.rarityTier,
    scarcityScore: match.card.scarcityScore,
    printRun: match.card.printRun,
    packOdds: match.card.packOdds,
    popTotal: match.card.popTotal,
    popGem: match.card.popGem,
    lockedFields: [],
    upgradeUrl,
    source,
    inspectedUrl: pageUrl
  };
}

module.exports = {
  buildRarityResponse,
  findBestMatch,
  normalizeTitle,
  scoreCard,
  tokenize
};
