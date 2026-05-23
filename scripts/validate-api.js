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
