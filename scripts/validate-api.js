const cards = require("../backend/data/cards.json");
const { buildRarityResponse } = require("../backend/lib/matcher");

const optionalCases = [
  {
    query: "2025-26 Topps Finest - First Ace Bailey #F-5 Sky Blue Refractor /150 (RC)",
    expected: "2025-26 Topps Finest First Ace Bailey Sky Blue Refractor /150 RC"
  },
  {
    query: "2025-26 Topps NBA Flagship Basketball Ace Bailey RC Rookie #205 Utah Jazz Base",
    expected: "2025-26 Topps Basketball Ace Bailey #205 RC",
    expectedPrintRun: 1265000
  },
  {
    query: "2022 Panini Prizm Patrick Mahomes Color Blast SSP PSA 10",
    expected: "2022 Panini Prizm Patrick Mahomes Color Blast SSP"
  }
];

const requiredCases = [
  {
    query: "completely unrelated listing title",
    expected: "Unknown"
  }
];

const failures = [];

function datasetContainsExpectedTitle(expected) {
  return cards.some((card) => card.canonicalTitle === expected);
}

function runCase(testCase) {
  const response = buildRarityResponse({
    query: testCase.query,
    source: "ebay",
    pageUrl: "https://www.ebay.com",
    cards,
    upgradeUrl: "https://chasingmajors.com/upgrade"
  });

  const passed = testCase.expected === "Unknown"
    ? response.rarityTier === "Unknown"
    : response.title === testCase.expected
      && (testCase.expectedPrintRun === undefined || response.printRun === testCase.expectedPrintRun);

  if (!passed) {
    failures.push({
      query: testCase.query,
      expected: testCase.expected,
      actual: response.title,
      rarityTier: response.rarityTier,
      matchConfidence: response.matchConfidence
    });
  }
}

for (const testCase of requiredCases) {
  runCase(testCase);
}

for (const testCase of optionalCases) {
  if (datasetContainsExpectedTitle(testCase.expected)) {
    runCase(testCase);
  }
}

const falseSetPositiveResponse = buildRarityResponse({
  query: "2025-26 Bowman #1 Cooper Flagg",
  source: "ebay",
  pageUrl: "https://www.ebay.com",
  cards: [
    {
      canonicalTitle: "2025 Bowman Draft Baseball - Auto. - In Action Auto. (Ref)",
      aliases: [
        "2025 Bowman Draft Baseball",
        "2025 Bowman Draft Baseball - Auto. - In Action Auto. (Ref)",
        "2025 Bowman Draft In Action Auto Ref"
      ],
      requiredTerms: ["2025", "bowman", "draft", "baseball", "auto", "action", "ref"],
      serialTerms: [],
      rarityTier: "Auto.",
      scarcityScore: 82,
      printRun: 100,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set"
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (falseSetPositiveResponse.rarityTier !== "Unknown") {
  failures.push({
    error: "Set-level false positive should not match",
    actual: falseSetPositiveResponse
  });
}

const specificSetResponse = buildRarityResponse({
  query: "2022 Topps Bowman Chrome Mojo Mega Autograph Baseball",
  source: "ebay",
  pageUrl: "https://www.ebay.com",
  cards: [
    {
      canonicalTitle: "2022 Topps Bowman Baseball - Autograph - Prospects Autographs",
      aliases: ["2022 Topps Bowman Baseball", "2022 Topps Bowman Prospects Autographs"],
      requiredTerms: ["2022", "topps", "bowman", "baseball", "prospects", "autographs"],
      serialTerms: [],
      rarityTier: "Autograph",
      scarcityScore: 68,
      printRun: 1952,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set"
    },
    {
      canonicalTitle: "2022 Topps Bowman Chrome Mojo Baseball - Autograph - Mega Autograph",
      aliases: ["2022 Topps Bowman Chrome Mojo Baseball", "2022 Topps Bowman Chrome Mojo Mega Autograph"],
      requiredTerms: ["2022", "topps", "bowman", "chrome", "mojo", "baseball", "mega", "autograph"],
      serialTerms: [],
      rarityTier: "Autograph",
      scarcityScore: 68,
      printRun: 1923,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set"
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (specificSetResponse.title !== "2022 Topps Bowman Chrome Mojo Baseball - Autograph - Mega Autograph") {
  failures.push({
    error: "Specific set modifiers should beat broader set rows",
    actual: specificSetResponse
  });
}

const ruleCards = [
  {
    canonicalTitle: "2025-26 Topps Basketball Cooper Flagg #1 RC",
    aliases: ["2025-26 Topps Basketball Cooper Flagg #1 RC"],
    requiredTerms: ["2025-26", "topps", "basketball", "cooper", "flagg", "1"],
    serialTerms: ["1"],
    rarityTier: "Base Rookie",
    scarcityScore: 54,
    printRun: 1265000,
    packOdds: "Base card",
    popTotal: 0,
    popGem: 0
  },
  {
    canonicalTitle: "2025-26 Topps Chrome Basketball Cooper Flagg #1 RC",
    aliases: ["2025-26 Topps Chrome Basketball Cooper Flagg #1 RC"],
    requiredTerms: ["2025-26", "topps", "chrome", "basketball", "cooper", "flagg", "1"],
    serialTerms: ["1"],
    rarityTier: "Chrome Rookie",
    scarcityScore: 62,
    printRun: 400000,
    packOdds: "Chrome base card",
    popTotal: 0,
    popGem: 0
  }
];

[
  "2025-26 Topps Basketball Cooper Flagg #1 RC Dallas Mavericks Gem Mint",
  "2025 -26 Topps Basketball Cooper Flagg #1 🔥 Rare Case Hit",
  "2025/26 Topps Basketball Cooper Flagg #1",
  "2025-2026 Topps Basketball Cooper Flagg #1"
].forEach((query) => {
  const response = buildRarityResponse({
    query,
    source: "ebay",
    pageUrl: "https://www.ebay.com",
    cards: ruleCards,
    upgradeUrl: "https://chasingmajors.com/upgrade"
  });

  if (response.title !== "2025-26 Topps Basketball Cooper Flagg #1 RC") {
    failures.push({
      error: "Season/noise/team normalization failed",
      query,
      actual: response
    });
  }
});

const chromeResponse = buildRarityResponse({
  query: "2025-26 Topps Chrome Basketball Cooper Flagg #1 RC",
  source: "ebay",
  pageUrl: "https://www.ebay.com",
  cards: ruleCards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (chromeResponse.title !== "2025-26 Topps Chrome Basketball Cooper Flagg #1 RC") {
  failures.push({
    error: "Topps Chrome should not collapse to plain Topps",
    actual: chromeResponse
  });
}

const digitalResponse = buildRarityResponse({
  query: "2025-26 Topps Bunt Digital Cooper Flagg #1",
  source: "ebay",
  pageUrl: "https://www.ebay.com",
  cards: ruleCards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (digitalResponse.rarityTier !== "Unsupported digital listing") {
  failures.push({
    error: "Digital/Bunt listing should be unsupported",
    actual: digitalResponse
  });
}

const invalidCards = cards.filter((card) => {
  const title = card.canonicalTitle || "";
  return !title
    || title.length < 10
    || !Array.isArray(card.requiredTerms)
    || card.requiredTerms.length < 2
    || /\btopps topps rc\b/i.test(title);
});

if (invalidCards.length) {
  failures.push({
    error: "Invalid imported cards",
    cards: invalidCards.slice(0, 10).map((card) => ({
      id: card.id,
      canonicalTitle: card.canonicalTitle,
      requiredTerms: card.requiredTerms
    }))
  });
}

if (failures.length) {
  console.error("API validation failed:");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log("CM Rarity API validation passed.");
