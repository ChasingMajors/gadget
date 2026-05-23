const NOISE_TERMS = new Set([
  "psa",
  "bgs",
  "sgc",
  "cgc",
  "gem",
  "mint",
  "graded",
  "grade",
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
  "sp"
]);

const BRAND_TERMS = new Set([
  "topps",
  "bowman",
  "panini",
  "donruss",
  "prizm",
  "select",
  "optic",
  "upper",
  "deck",
  "fleer",
  "skybox",
  "leaf",
  "score",
  "wild",
  "card",
  "sage"
]);

export function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[#(),.:;!?'"[\]{}|\\]/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(title) {
  return normalizeTitle(title)
    .split(" ")
    .filter((token) => token.length > 1)
    .filter((token) => !NOISE_TERMS.has(token));
}

function tokenSet(title) {
  return new Set(tokenize(title));
}

function metadataTokens(value) {
  return tokenize(value).filter((token) => token !== "base");
}

function missingTokens(queryTokens, tokens) {
  return tokens.filter((token) => !queryTokens.has(token));
}

function setSpecificityPenalty(queryTokens, card) {
  if (card.matchMode !== "set") {
    return 0;
  }

  const metadata = card.metadata || {};
  const brandTokens = new Set(metadataTokens(metadata.brand));
  const sportTokens = new Set(metadataTokens(metadata.sport));
  const queryBrandTokens = Array.from(queryTokens).filter((token) => BRAND_TERMS.has(token));
  const missingBrandTokens = missingTokens(queryTokens, Array.from(brandTokens));

  if (missingBrandTokens.length && queryBrandTokens.some((token) => !brandTokens.has(token))) {
    return -0.6;
  }

  const productTokens = metadataTokens(metadata.product)
    .filter((token) => !brandTokens.has(token))
    .filter((token) => !sportTokens.has(token));
  const lineTokens = metadataTokens(metadata.setLine);
  const typeTokens = metadataTokens(metadata.setType);

  const missingProductTokens = missingTokens(queryTokens, productTokens);
  if (missingProductTokens.length) {
    return -0.45;
  }

  const modifierTokens = Array.from(new Set([...lineTokens, ...typeTokens]))
    .filter((token) => !brandTokens.has(token))
    .filter((token) => !sportTokens.has(token))
    .filter((token) => !productTokens.includes(token))
    .filter((token) => !NOISE_TERMS.has(token));
  const missingModifierTokens = missingTokens(queryTokens, modifierTokens);

  if (modifierTokens.length && missingModifierTokens.length === modifierTokens.length) {
    return -0.24;
  }

  return 0;
}

function setSpecificityHits(queryTokens, card) {
  if (card.matchMode !== "set") {
    return 0;
  }

  const metadata = card.metadata || {};
  const brandTokens = new Set(metadataTokens(metadata.brand));
  const sportTokens = new Set(metadataTokens(metadata.sport));
  const tokens = Array.from(new Set([
    ...metadataTokens(metadata.product),
    ...metadataTokens(metadata.setLine),
    ...metadataTokens(metadata.setType)
  ]))
    .filter((token) => !brandTokens.has(token))
    .filter((token) => !sportTokens.has(token));

  return tokens.filter((token) => queryTokens.has(token)).length;
}

function includesAlias(query, card) {
  const normalizedQuery = normalizeTitle(query);
  return [card.canonicalTitle, ...(card.aliases || [])]
    .map(normalizeTitle)
    .some((alias) => alias && normalizedQuery.includes(alias));
}

function hasRequiredTerms(queryTokens, card) {
  if (card.matchMode === "set") {
    const terms = card.requiredTerms || [];
    const hits = terms.filter((term) => queryTokens.has(term)).length;
    return hits >= Math.min(4, terms.length);
  }

  return (card.requiredTerms || []).every((term) => queryTokens.has(term));
}

function serialScore(normalizedQuery, card) {
  const serialTerms = card.serialTerms || [];
  if (!serialTerms.length) {
    return 0;
  }

  return serialTerms.some((term) => normalizedQuery.includes(String(term).toLowerCase())) ? 0.12 : -0.08;
}

export function scoreCard(query, card) {
  const queryTokens = tokenSet(query);
  const normalizedQuery = normalizeTitle(query);
  const cardTokens = tokenSet([card.canonicalTitle, ...(card.aliases || [])].join(" "));
  const overlap = Array.from(cardTokens).filter((token) => queryTokens.has(token));
  const coverage = cardTokens.size ? overlap.length / cardTokens.size : 0;
  const hasRequired = hasRequiredTerms(queryTokens, card);
  if (card.matchMode === "set" && !hasRequired) {
    return 0;
  }

  const requiredBoost = hasRequired ? 0.22 : -0.2;
  const aliasBoost = includesAlias(query, card) ? 0.25 : 0;
  const setBoost = card.matchMode === "set" ? 0.08 : 0;
  const score = coverage * 0.68
    + requiredBoost
    + aliasBoost
    + serialScore(normalizedQuery, card)
    + setBoost
    + setSpecificityPenalty(queryTokens, card);

  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

export function findBestMatch(query, cardData, minimumConfidence = 0.54) {
  const queryTokens = tokenSet(query);
  const ranked = cardData
    .map((card) => ({
      card,
      confidence: scoreCard(query, card),
      specificity: setSpecificityHits(queryTokens, card)
    }))
    .sort((a, b) => b.confidence - a.confidence || b.specificity - a.specificity);

  const best = ranked[0];

  if (!best || best.confidence < minimumConfidence) {
    return {
      card: null,
      confidence: best?.confidence || 0
    };
  }

  return best;
}

export function buildRarityResponse({ query, source, pageUrl, cards, upgradeUrl }) {
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
    inspectedUrl: pageUrl,
    matchMode: match.card.matchMode || "card"
  };
}
