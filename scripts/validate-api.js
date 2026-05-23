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
  },
  {
    query: "2025-26 Topps NBA Flagship Basketball Ace Bailey RC Rookie #205 Utah Jazz Base",
    expected: "2025-26 Topps Basketball - Base",
    expectedPrintRun: 1265000
  },
  {
    query: "2025-26 Topps - [Base] #201 Cooper Flagg #/1,265,000 Basketball",
    source: "comc",
    expected: "2025-26 Topps Basketball - Base",
    expectedPrintRun: 1265000
  },
  {
    query: "2025-26 topps mirror image",
    expected: "2025-26 Topps Basketball - Variation - Golden Mirror SSP",
    expectedPrintRun: 155
  },
  {
    query: "2025-26 topps mirror image basketball",
    expected: "2025-26 Topps Basketball - Variation - Golden Mirror SSP",
    expectedPrintRun: 155,
    minimumConfidence: 0.59
  },
  {
    query: "2025-26 Topps Chrome basketball Gold /50",
    expected: "Unknown"
  },
  {
    query: "2025-26 Topps Chrome - [Base] - Xfractors #251 Cooper Flagg Basketball",
    source: "comc",
    expected: "2025-26 Topps Chrome Basketball - Base - Parallel - X-Fractors",
    expectedPrintRun: 7750
  }
];

const failures = [];

function datasetContainsExpectedTitle(expected) {
  return cards.some((card) => card.canonicalTitle === expected);
}

function runCase(testCase) {
  const response = buildRarityResponse({
    query: testCase.query,
    source: testCase.source || "ebay",
    pageUrl: "https://www.ebay.com",
    cards,
    upgradeUrl: "https://chasingmajors.com/upgrade"
  });

  const passed = testCase.expected === "Unknown"
    ? response.rarityTier === "Unknown"
    : response.title === testCase.expected
      && (testCase.expectedPrintRun === undefined || response.printRun === testCase.expectedPrintRun)
      && (testCase.minimumConfidence === undefined || response.matchConfidence >= testCase.minimumConfidence);

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

const plainToppsResponse = buildRarityResponse({
  query: "2025-26 Topps NBA Flagship Basketball Cooper Flagg RC Rookie #201 Dallas Mavericks Base",
  source: "ebay",
  pageUrl: "https://www.ebay.com",
  cards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (plainToppsResponse.title !== "2025-26 Topps Basketball - Base" || plainToppsResponse.printRun !== 1265000) {
  failures.push({
    error: "Plain Topps Basketball base should not match Chrome/Sapphire/parallel rows",
    actual: plainToppsResponse
  });
}

const serialNumberedResponse = buildRarityResponse({
  query: "2025-26 Topps Chrome Basketball Gold Refractor /50",
  source: "ebay",
  pageUrl: "https://www.ebay.com",
  cards: [
    {
      canonicalTitle: "2025-26 Topps Chrome Basketball - Base - Parallel - Gold Refractor",
      aliases: [
        "2025-26 Topps Chrome Basketball",
        "2025-26 Topps Chrome Basketball Gold Refractor"
      ],
      requiredTerms: ["2025", "26", "topps", "chrome", "basketball", "gold", "refractor"],
      serialTerms: ["/50", "50"],
      rarityTier: "Base - Parallel",
      scarcityScore: 82,
      printRun: 50,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Topps",
        product: "Chrome",
        setType: "Base - Parallel",
        setLine: "Gold Refractor"
      }
    },
    {
      canonicalTitle: "2025-26 Topps Chrome Basketball - Autograph - Chrome Rookie Auto",
      aliases: [
        "2025-26 Topps Chrome Basketball",
        "2025-26 Topps Chrome Basketball Chrome Rookie Auto"
      ],
      requiredTerms: ["2025", "26", "topps", "chrome", "basketball", "auto"],
      serialTerms: [],
      rarityTier: "Autograph",
      scarcityScore: 68,
      printRun: 2250,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Topps",
        product: "Chrome",
        setType: "Autograph",
        setLine: "Chrome Rookie Auto"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (serialNumberedResponse.title !== "2025-26 Topps Chrome Basketball - Base - Parallel - Gold Refractor") {
  failures.push({
    error: "Serial-numbered query should prefer the matching /50 parallel over broad set rows",
    actual: serialNumberedResponse
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
