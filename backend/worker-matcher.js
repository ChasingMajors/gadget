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

const SPORT_TERMS = new Set([
  "baseball",
  "basketball",
  "football",
  "hockey",
  "soccer",
  "wrestling",
  "ufc",
  "racing",
  "tennis",
  "golf"
]);

const AUTOGRAPH_TERMS = new Set([
  "auto",
  "autograph",
  "autographs",
  "signed",
  "signature",
  "signatures",
  "ink",
  "graphs"
]);

const VARIANT_TERMS = new Set([
  "aqua",
  "blackout",
  "blue",
  "crackleboard",
  "diamante",
  "foil",
  "foilboard",
  "fractor",
  "geometric",
  "gold",
  "green",
  "holo",
  "mojo",
  "mirror",
  "orange",
  "parallel",
  "pink",
  "prism",
  "pulsar",
  "rainbow",
  "raywave",
  "refractor",
  "sandglitter",
  "shimmer",
  "sapphire",
  "silver",
  "wave",
  "xfractor",
  "xfractors"
]);

export function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/\b([a-z0-9]+)['\u2019]s\b/g, "$1s")
    .replace(/\bx[\s-]?fractors?\b/g, " xfractors ")
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

function queryTokensForCard(query, card) {
  const tokens = tokenSet(query);
  const normalizedQuery = normalizeTitle(query);
  const normalizedCard = normalizeTitle([
    card.canonicalTitle,
    card.metadata?.setLine,
    card.metadata?.parallel,
    ...(card.aliases || [])
  ].filter(Boolean).join(" "));

  if (/\bmirror image\b/.test(normalizedQuery) && /\bgolden mirror\b/.test(normalizedCard)) {
    tokens.add("golden");
  }

  return tokens;
}

function metadataTokens(value) {
  return tokenize(value).filter((token) => token !== "base");
}

function comcStructuredParts(query) {
  const rawParts = String(query || "")
    .replace(/\u00a0/g, " ")
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length < 2 || !/^(?:19|20)\d{2}(?:\s*[-/]\s*\d{2,4})?\b/.test(rawParts[0])) {
    return [];
  }

  const setParts = [];
  for (const part of rawParts.slice(1)) {
    const hasCardNumber = /\s+#\S+/.test(part);
    const cleaned = part
      .replace(/\s+#\S+.*$/g, "")
      .replace(/^\[base\]$/i, "base")
      .trim();

    if (cleaned) {
      setParts.push(cleaned);
    }

    if (hasCardNumber) {
      break;
    }
  }

  return setParts
    .map((part) => metadataTokens(part))
    .filter((tokens) => tokens.length);
}

function comcCardPartGroups(card) {
  const metadata = card.metadata || {};
  return [
    metadata.product,
    metadata.setType,
    metadata.setLine,
    metadata.parallel
  ]
    .map(metadataTokens)
    .filter((tokens) => tokens.length);
}

function comcStructuredScore(query, queryTokens, card) {
  if (card.matchMode !== "set") {
    return 0;
  }

  const parts = comcStructuredParts(query);
  if (!parts.length) {
    return 0;
  }

  const cardTokens = tokenSet([
    card.canonicalTitle,
    card.metadata?.product,
    card.metadata?.setType,
    card.metadata?.setLine,
    card.metadata?.parallel,
    ...(card.aliases || [])
  ].filter(Boolean).join(" "));
  const cardPartGroups = comcCardPartGroups(card);

  const hasStructuredParts = parts.every((partTokens) => cardPartGroups
    .some((groupTokens) => partTokens.every((token) => groupTokens.includes(token))));
  const hasAllParts = parts.every((partTokens) => partTokens.every((token) => cardTokens.has(token)));
  if (!hasStructuredParts && hasAllParts) {
    return -0.95;
  }

  if (hasAllParts) {
    const extraSpecificTokens = parts.flatMap((partTokens) => {
      const matchingGroup = cardPartGroups
        .filter((groupTokens) => partTokens.every((token) => groupTokens.includes(token)))
        .sort((a, b) => a.length - b.length)[0];

      if (!matchingGroup) {
        return [];
      }

      return matchingGroup
        .filter((token) => !partTokens.includes(token))
        .filter((token) => !NOISE_TERMS.has(token));
    });

    if (extraSpecificTokens.length) {
      return -0.45;
    }

    const parallelTokens = metadataTokens(card.metadata?.parallel);
    if (parallelTokens.length && parallelTokens.some((token) => !queryTokens.has(token))) {
      return -0.45;
    }

    return 0.18;
  }

  const missingSpecificParts = parts
    .filter((partTokens) => partTokens.some((token) => !cardTokens.has(token)))
    .filter((partTokens) => partTokens.some((token) => queryTokens.has(token)));

  return missingSpecificParts.length ? -0.95 : 0;
}

function missingTokens(queryTokens, tokens) {
  return tokens.filter((token) => !queryTokens.has(token));
}

function sportMismatchPenalty(queryTokens, card) {
  if (card.matchMode !== "set") {
    return 0;
  }

  const sportTokens = new Set(metadataTokens(card.metadata?.sport));
  const querySportTokens = Array.from(queryTokens).filter((token) => SPORT_TERMS.has(token));

  if (!querySportTokens.length || !sportTokens.size) {
    return 0;
  }

  return querySportTokens.some((token) => !sportTokens.has(token)) ? -0.72 : 0;
}

function sportIntentTokens(queryTokens) {
  return Array.from(queryTokens).filter((token) => SPORT_TERMS.has(token));
}

function yearMismatchPenalty(queryTokens, card) {
  if (card.matchMode !== "set") {
    return 0;
  }

  const metadata = card.metadata || {};
  const cardYearTokens = metadataTokens(metadata.year)
    .filter((token) => /^(?:19|20)\d{2}$/.test(token));
  const queryYearTokens = Array.from(queryTokens)
    .filter((token) => /^(?:19|20)\d{2}$/.test(token));

  if (!cardYearTokens.length || !queryYearTokens.length) {
    return 0;
  }

  return cardYearTokens.some((token) => queryYearTokens.includes(token)) ? 0 : -0.95;
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
  const parallelTokens = metadataTokens(metadata.parallel);
  const typeTokens = metadataTokens(metadata.setType);

  const missingProductTokens = missingTokens(queryTokens, productTokens);
  if (missingProductTokens.length) {
    return -0.45;
  }

  const modifierTokens = Array.from(new Set([...lineTokens, ...parallelTokens, ...typeTokens]))
    .filter((token) => !brandTokens.has(token))
    .filter((token) => !sportTokens.has(token))
    .filter((token) => !productTokens.includes(token))
    .filter((token) => !NOISE_TERMS.has(token));
  const queryVariantTokens = Array.from(queryTokens).filter((token) => VARIANT_TERMS.has(token));

  if (!modifierTokens.length && queryVariantTokens.length) {
    return -0.42;
  }

  const unmatchedQueryVariants = queryVariantTokens
    .filter((token) => !modifierTokens.includes(token))
    .filter((token) => !productTokens.includes(token));

  if (unmatchedQueryVariants.length) {
    return -0.3;
  }

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
    ...metadataTokens(metadata.parallel),
    ...metadataTokens(metadata.setType)
  ]))
    .filter((token) => !brandTokens.has(token))
    .filter((token) => !sportTokens.has(token));

  return tokens.filter((token) => queryTokens.has(token)).length;
}

function cardVariantTokens(card) {
  return tokenSet([
    card.canonicalTitle,
    card.metadata?.setLine,
    card.metadata?.parallel,
    card.metadata?.setType,
    ...(card.aliases || [])
  ].filter(Boolean).join(" "));
}

function cardTokensForIntent(card) {
  return tokenSet([
    card.canonicalTitle,
    card.metadata?.setType,
    card.metadata?.setLine,
    card.metadata?.parallel,
    ...(card.aliases || []),
    ...(card.requiredTerms || [])
  ].filter(Boolean).join(" "));
}

function isAutographCard(card) {
  const tokens = cardTokensForIntent(card);
  return Array.from(AUTOGRAPH_TERMS).some((token) => tokens.has(token));
}

function hasAutographIntent(queryTokens) {
  return Array.from(queryTokens).some((token) => AUTOGRAPH_TERMS.has(token));
}

function synonymScore(query, card) {
  const normalizedQuery = normalizeTitle(query);
  const normalizedCard = normalizeTitle([
    card.canonicalTitle,
    card.metadata?.setLine,
    card.metadata?.parallel,
    ...(card.aliases || [])
  ].filter(Boolean).join(" "));

  if (/\bmirror image\b/.test(normalizedQuery) && /\bgolden mirror\b/.test(normalizedCard)) {
    return 0.08;
  }

  return 0;
}

function unmatchedQueryVariants(queryTokens, card) {
  const queryVariantTokens = Array.from(queryTokens).filter((token) => VARIANT_TERMS.has(token));
  if (!queryVariantTokens.length) {
    return [];
  }

  const tokens = cardVariantTokens(card);
  return queryVariantTokens.filter((token) => !tokens.has(token));
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

function querySerialLimit(query) {
  const match = String(query || "").match(/\/\s*([\d,]{1,9})\b/);
  if (!match) {
    return null;
  }

  const limit = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(limit) && limit > 0 && limit <= 10000 ? limit : null;
}

function serialLimitScore(query, normalizedQuery, card) {
  const limit = querySerialLimit(query);
  if (!limit) {
    return 0;
  }

  const serialTerms = card.serialTerms || [];
  const hasSerialTerm = serialTerms.some((term) => normalizedQuery.includes(String(term).toLowerCase()));
  const hasPrintRunMatch = Number(card.printRun) === limit;

  if (hasSerialTerm || hasPrintRunMatch) {
    return 0.12;
  }

  return -0.32;
}

function serialVariantPenalty(query, queryTokens, card) {
  if (!querySerialLimit(query)) {
    return 0;
  }

  return unmatchedQueryVariants(queryTokens, card).length ? -0.28 : 0;
}

function variantMismatchPenalty(queryTokens, card) {
  if (card.matchMode !== "set") {
    return 0;
  }

  return unmatchedQueryVariants(queryTokens, card).length ? -0.32 : 0;
}

export function scoreCard(query, card) {
  const queryTokens = queryTokensForCard(query, card);
  const normalizedQuery = normalizeTitle(query);
  const cardTokens = tokenSet([card.canonicalTitle, ...(card.aliases || [])].join(" "));
  const overlap = Array.from(cardTokens).filter((token) => queryTokens.has(token));
  const coverage = cardTokens.size ? overlap.length / cardTokens.size : 0;
  const hasRequired = hasRequiredTerms(queryTokens, card);
  if (card.matchMode === "set" && !hasRequired) {
    return 0;
  }

  if (card.matchMode === "set" && isAutographCard(card) && !hasAutographIntent(queryTokens)) {
    return 0;
  }

  const requiredBoost = hasRequired ? 0.22 : -0.2;
  const aliasBoost = includesAlias(query, card) ? 0.25 : 0;
  const setBoost = card.matchMode === "set" ? 0.08 : 0;
  const score = coverage * 0.68
    + requiredBoost
    + aliasBoost
    + serialScore(normalizedQuery, card)
    + serialLimitScore(query, normalizedQuery, card)
    + serialVariantPenalty(query, queryTokens, card)
    + variantMismatchPenalty(queryTokens, card)
    + yearMismatchPenalty(queryTokens, card)
    + sportMismatchPenalty(queryTokens, card)
    + synonymScore(query, card)
    + comcStructuredScore(query, queryTokens, card)
    + setBoost
    + setSpecificityPenalty(queryTokens, card);

  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

export function findBestMatch(query, cardData, minimumConfidence = 0.54) {
  const plainQueryTokens = tokenSet(query);
  const ranked = cardData
    .map((card) => ({
      card,
      confidence: scoreCard(query, card),
      specificity: setSpecificityHits(queryTokensForCard(query, card), card)
    }))
    .sort((a, b) => b.confidence - a.confidence || b.specificity - a.specificity);

  const best = ranked[0];

  if (!best || best.confidence < minimumConfidence) {
    return {
      card: null,
      confidence: best?.confidence || 0
    };
  }

  if (best.card.matchMode === "set" && !sportIntentTokens(plainQueryTokens).length) {
    const bestSport = normalizeTitle(best.card.metadata?.sport);
    const ambiguousSport = ranked.slice(1).some((candidate) => {
      const candidateSport = normalizeTitle(candidate.card.metadata?.sport);
      return candidate.confidence >= minimumConfidence
        && best.confidence - candidate.confidence <= 0.04
        && candidateSport
        && bestSport
        && candidateSport !== bestSport;
    });

    if (ambiguousSport) {
      return {
        card: null,
        confidence: best.confidence
      };
    }
  }

  return best;
}

function scarcityScoreForPrintRun(printRun) {
  return printRun <= 1000 ? 82 : printRun <= 10000 ? 68 : 54;
}

export function buildRarityResponse({ query, source, pageUrl, cards, upgradeUrl }) {
  const match = findBestMatch(query, cards);
  const serialLimit = querySerialLimit(query);

  if (!match.card) {
    if (serialLimit && source === "comc") {
      return {
        title: query || "Serial-numbered card",
        matchConfidence: match.confidence,
        rarityTier: "Serial Numbered",
        scarcityScore: scarcityScoreForPrintRun(serialLimit),
        printRun: serialLimit,
        packOdds: null,
        popTotal: null,
        popGem: null,
        lockedFields: [],
        upgradeUrl,
        source,
        inspectedUrl: pageUrl,
        matchMode: "set"
      };
    }

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
      upgradeUrl,
      source,
      inspectedUrl: pageUrl,
      matchMode: source === "comc" ? "set" : "card"
    };
  }

  return {
    title: match.card.canonicalTitle,
    matchConfidence: match.confidence,
    rarityTier: match.card.rarityTier,
    scarcityScore: match.card.scarcityScore,
    printRun: serialLimit || match.card.printRun,
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
