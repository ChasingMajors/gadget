const cards = require("../backend/data/cards.json");
const { buildRarityResponse } = require("../backend/lib/matcher");

const cases = [
  {
    query: "2025-26 Topps Finest - First Ace Bailey #F-5 Sky Blue Refractor /150 (RC)",
    expected: "2025-26 Topps Finest First Ace Bailey Sky Blue Refractor /150 RC"
  },
  {
    query: "2022 Panini Prizm Patrick Mahomes Color Blast SSP PSA 10",
    expected: "2022 Panini Prizm Patrick Mahomes Color Blast SSP"
  },
  {
    query: "completely unrelated listing title",
    expected: "Unknown"
  }
];

const failures = [];

for (const testCase of cases) {
  const response = buildRarityResponse({
    query: testCase.query,
    source: "ebay",
    pageUrl: "https://www.ebay.com",
    cards,
    upgradeUrl: "https://chasingmajors.com/upgrade"
  });

  const passed = testCase.expected === "Unknown"
    ? response.rarityTier === "Unknown"
    : response.title === testCase.expected;

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

if (failures.length) {
  console.error("API validation failed:");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log("CM Rarity API validation passed.");
