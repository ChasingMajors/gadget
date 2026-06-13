const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
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
    minimumConfidence: 0.64
  },
  {
    query: "2025-26 Topps Chrome basketball Gold /50",
    expected: [
      "Unknown",
      "2025-26 Topps Chrome Basketball - Base - Refractor Gold"
    ],
    expectedPrintRun: 50
  },
  {
    query: "2025-26 Topps Chrome basketball Gold",
    expected: [
      "Unknown",
      "2025-26 Topps Chrome Basketball - Base - Refractor Gold"
    ],
    expectedPrintRun: 50
  },
  {
    query: "2025-26 Topps Chrome - [Base] - Xfractors #251 Cooper Flagg Basketball",
    source: "comc",
    expected: [
      "2025-26 Topps Chrome Basketball - Base - Parallel - X-Fractors",
      "2025-26 Topps Chrome Basketball - Base - Parallel - X-Fractor",
      "2025-26 Topps Chrome Basketball - Base - X-Fractor"
    ],
    expectedPrintRun: 7750
  },
  {
    query: "1993 Topps Finest - Base - Refractor #3 Baseballs Finest - Bryan Harvey Baseball Baseball's Finest - Bryan Harvey",
    source: "comc",
    expected: "1993 Topps Finest Baseball - Base - Refractor",
    expectedPackOdds: "1:15",
    minimumConfidence: 0.9
  }
];

const failures = [];

function validateSetPrvImportHeaders() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-prv-import-"));
  const inputPath = path.join(tempDir, "new-prv.csv");
  const outputPath = path.join(tempDir, "cards.json");
  const csv = [
    "Code,DisplayName,Keywords,year,sport,manufacturer,product,setType,setLine,parallel,printRun,serial,subSetSize,packOdds",
    "2025_26_topps_chrome_basketball,2025-26 Topps Chrome Basketball,topps chrome gold basketball,2025-26,Basketball,Topps,Chrome,Base - Parallel,Base,Gold,50,50,300,1:120 packs",
    "2025_26_topps_chrome_basketball_xfractors,2025-26 Topps Chrome Basketball,topps chrome xfractors basketball,2025-26,Basketball,Topps,Chrome,Base - Parallel,Base,X-Fractors,7750,,299,",
    "2025_26_bowman_basketball_blue_reptilian,2025-26 Bowman Basketball,bowman basketball blue reptilian refractor,2025-26,Basketball,Bowman,,Variation,Chrome,Blue Reptilian Refractor,,#/150,150,"
  ].join("\n");

  fs.writeFileSync(inputPath, csv);
  const result = spawnSync(process.execPath, ["scripts/import-prv-csv.js", inputPath, outputPath], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    failures.push({
      error: "NewPRV header import fixture failed",
      stderr: result.stderr,
      stdout: result.stdout
    });
    return;
  }

  const imported = JSON.parse(fs.readFileSync(outputPath, "utf8"))[0];
  const xfractor = JSON.parse(fs.readFileSync(outputPath, "utf8"))[1];
  const serialOnly = JSON.parse(fs.readFileSync(outputPath, "utf8"))[2];
  if (!imported
    || imported.id !== "2025-26-topps-chrome-basketball-base-parallel-gold"
    || imported.canonicalTitle !== "2025-26 Topps Chrome Basketball - Base - Parallel - Gold"
    || imported.packOdds !== "1:120 packs"
    || imported.metadata.code !== "2025_26_topps_chrome_basketball"
    || imported.metadata.parallel !== "Gold"
    || imported.metadata.serial !== "50"
    || !imported.requiredTerms.includes("gold")
    || !imported.serialTerms.includes("/50")) {
    failures.push({
      error: "NewPRV headers should import parallel, serial, and pack odds",
      imported
    });
  }

  if (!xfractor
    || xfractor.canonicalTitle !== "2025-26 Topps Chrome Basketball - Base - Parallel - X-Fractors"
    || xfractor.metadata.parallel !== "X-Fractors"
    || !xfractor.requiredTerms.includes("xfractors")) {
    failures.push({
      error: "NewPRV parallel aliases should normalize X-Fractors consistently",
      imported: xfractor
    });
  }

  if (!serialOnly
    || serialOnly.printRun !== 150
    || serialOnly.metadata.serial !== "150"
    || !serialOnly.serialTerms.includes("/150")
    || !serialOnly.requiredTerms.includes("blue")
    || !serialOnly.requiredTerms.includes("reptilian")) {
    failures.push({
      error: "NewPRV serial column should import serial-only print runs",
      imported: serialOnly
    });
  }
}

function validateSetPrvPrintRunAliases() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-prv-pr-import-"));
  const inputPath = path.join(tempDir, "new-prv-pr.csv");
  const outputPath = path.join(tempDir, "cards.json");
  const csv = [
    "Code,DisplayName,Keywords,year,sport,manufacturer,product,setType,setLine,parallel,PR,serial,subSetSize,packOdds",
    "2025_26_bowman_basketball_greatness_loading,2025-26 Bowman Basketball,bowman greatness loading refractor basketball,2025-26,Basketball,Bowman,,Insert,Greatness Loading,Refractor,4025,,25,"
  ].join("\n");

  fs.writeFileSync(inputPath, csv);
  const result = spawnSync(process.execPath, ["scripts/import-prv-csv.js", inputPath, outputPath], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    failures.push({
      error: "NewPRV PR header import fixture failed",
      stderr: result.stderr,
      stdout: result.stdout
    });
    return;
  }

  const imported = JSON.parse(fs.readFileSync(outputPath, "utf8"))[0];
  if (!imported
    || imported.canonicalTitle !== "2025-26 Bowman Basketball - Insert - Greatness Loading - Refractor"
    || imported.printRun !== 4025
    || imported.metadata.serial !== "") {
    failures.push({
      error: "NewPRV PR header should import non-serial print runs",
      imported
    });
  }
}

function validateSetPrvPackOddsOnlyRows() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-prv-odds-import-"));
  const inputPath = path.join(tempDir, "new-prv-odds.csv");
  const outputPath = path.join(tempDir, "cards.json");
  const csv = [
    "Code,DisplayName,Keywords,year,sport,manufacturer,product,setType,setLine,parallel,printRun,serial,subSetSize,packOdds",
    "1993_94_topps_finest_basketball,1993-94 Topps Finest Basketball,topps finest refractor basketball,1993-94,Basketball,Topps,Finest,Parallel,Base,Refractor,,,220,1:9 packs"
  ].join("\n");

  fs.writeFileSync(inputPath, csv);
  const result = spawnSync(process.execPath, ["scripts/import-prv-csv.js", inputPath, outputPath], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    failures.push({
      error: "Pack-odds-only PRV row import fixture failed",
      stderr: result.stderr,
      stdout: result.stdout
    });
    return;
  }

  const imported = JSON.parse(fs.readFileSync(outputPath, "utf8"))[0];
  if (!imported
    || imported.canonicalTitle !== "1993-94 Topps Finest Basketball - Parallel - Base - Refractor"
    || imported.printRun !== null
    || imported.packOdds !== "1:9 packs"
    || !imported.requiredTerms.includes("refractor")) {
    failures.push({
      error: "Pack-odds-only PRV rows should import without print run or serial",
      imported
    });
  }
}

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

  const expectedTitles = Array.isArray(testCase.expected) ? testCase.expected : [testCase.expected];
  const expectedUnknown = expectedTitles.includes("Unknown");
  const passedUnknown = expectedUnknown && response.rarityTier === "Unknown";
  const passedMatched = expectedTitles.includes(response.title)
    && response.rarityTier !== "Unknown"
    && (testCase.expectedPrintRun === undefined || response.printRun === testCase.expectedPrintRun)
    && (testCase.expectedPackOdds === undefined || response.packOdds === testCase.expectedPackOdds)
    && (testCase.minimumConfidence === undefined || response.matchConfidence >= testCase.minimumConfidence);
  const passed = passedUnknown || passedMatched;

  if (!passed) {
    failures.push({
      query: testCase.query,
      expected: testCase.expected,
      actual: response.title,
      rarityTier: response.rarityTier,
      matchConfidence: response.matchConfidence,
      printRun: response.printRun,
      packOdds: response.packOdds
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

validateSetPrvImportHeaders();
validateSetPrvPrintRunAliases();
validateSetPrvPackOddsOnlyRows();

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

const mirrorVariantResponse = buildRarityResponse({
  query: "2025-26 topps mirror image basketball",
  source: "ebay",
  pageUrl: "https://www.ebay.com",
  cards: [
    {
      canonicalTitle: "2025-26 Topps Basketball - Base",
      aliases: [
        "2025-26 Topps Basketball",
        "2025-26 Topps Basketball - Base"
      ],
      requiredTerms: ["2025", "26", "topps", "basketball"],
      serialTerms: [],
      rarityTier: "Base",
      scarcityScore: 54,
      printRun: 1265000,
      packOdds: "Base card",
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Topps",
        product: "Topps",
        setType: "Base",
        setLine: "Base"
      }
    },
    {
      canonicalTitle: "2025-26 Topps Basketball - Variation - Golden Mirror SSP",
      aliases: [
        "2025-26 Topps Basketball",
        "2025-26 Topps Basketball - Variation - Golden Mirror SSP"
      ],
      requiredTerms: ["2025", "26", "topps", "basketball", "golden", "mirror"],
      serialTerms: [],
      rarityTier: "Variation",
      scarcityScore: 82,
      printRun: 155,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Topps",
        product: "Topps",
        setType: "Variation",
        setLine: "Golden Mirror SSP"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (mirrorVariantResponse.title !== "2025-26 Topps Basketball - Variation - Golden Mirror SSP") {
  failures.push({
    error: "Mirror Image query should prefer Golden Mirror variation over broad base rows",
    actual: mirrorVariantResponse
  });
}

const sportMismatchResponse = buildRarityResponse({
  query: "2025-26 Topps Chrome - [Base] - Xfractors #251 Cooper Flagg Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards: [
    {
      canonicalTitle: "2025 Topps Chrome Baseball - Base - Parallel - X-Fractor",
      aliases: [
        "2025 Topps Chrome X-Fractor",
        "Topps Chrome X-Fractor"
      ],
      requiredTerms: ["2025", "topps", "chrome", "xfractors"],
      serialTerms: [],
      rarityTier: "Base - Parallel",
      scarcityScore: 68,
      printRun: 5000,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025",
        sport: "Baseball",
        brand: "Topps",
        product: "Chrome",
        setType: "Base - Parallel",
        setLine: "X-Fractor"
      }
    },
    {
      canonicalTitle: "2025-26 Topps Chrome Basketball - Base - Parallel - X-Fractors",
      aliases: [
        "2025-26 Topps Chrome Basketball",
        "2025-26 Topps Chrome X-Fractors"
      ],
      requiredTerms: ["2025", "26", "topps", "chrome", "basketball", "xfractors"],
      serialTerms: [],
      rarityTier: "Base - Parallel",
      scarcityScore: 68,
      printRun: 7750,
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
        setLine: "X-Fractors"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (sportMismatchResponse.title !== "2025-26 Topps Chrome Basketball - Base - Parallel - X-Fractors") {
  failures.push({
    error: "Basketball query should not prefer a Baseball X-Fractor row",
    actual: sportMismatchResponse
  });
}

const nonAutoComcResponse = buildRarityResponse({
  query: "2025-26 Bowman - Greatness Loading - Refractor #GL-5 Ace Bailey Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards: [
    {
      canonicalTitle: "2025-26 Bowman Basketball - Autograph - Greatness Loading Autographs - Refractor",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Greatness Loading Autographs Refractor",
        "2025-26 Bowman Autograph"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "greatness", "loading", "autographs", "refractor"],
      serialTerms: [],
      rarityTier: "Autograph",
      scarcityScore: 82,
      printRun: 145,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Autograph",
        setLine: "Greatness Loading Autographs",
        parallel: "Refractor"
      }
    },
    {
      canonicalTitle: "2025-26 Bowman Basketball - Insert - Greatness Loading - Refractor",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Greatness Loading Refractor",
        "2025-26 Bowman Insert"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "greatness", "loading", "refractor"],
      serialTerms: [],
      rarityTier: "Insert",
      scarcityScore: 68,
      printRun: 4025,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Insert",
        setLine: "Greatness Loading",
        parallel: "Refractor"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (nonAutoComcResponse.title !== "2025-26 Bowman Basketball - Insert - Greatness Loading - Refractor") {
  failures.push({
    error: "Non-autograph COMC title should not match autograph rows",
    actual: nonAutoComcResponse
  });
}

const comcStructuredResponse = buildRarityResponse({
  query: "2025-26 Bowman - Greatness Loading - Refractor #GL-5 Ace Bailey Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards: [
    {
      canonicalTitle: "2025-26 Bowman Basketball - Variation - Chrome Rookie Red RC Logo",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Chrome Rookie Red RC Logo"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "chrome", "red", "logo"],
      serialTerms: [],
      rarityTier: "Variation",
      scarcityScore: 68,
      printRun: 8000,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Variation",
        setLine: "Chrome Rookie Red RC Logo",
        parallel: ""
      }
    },
    {
      canonicalTitle: "2025-26 Bowman Basketball - Insert - Greatness Loading - Refractor",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Greatness Loading Refractor"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "greatness", "loading", "refractor"],
      serialTerms: [],
      rarityTier: "Insert",
      scarcityScore: 68,
      printRun: 4025,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Insert",
        setLine: "Greatness Loading",
        parallel: "Refractor"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (comcStructuredResponse.title !== "2025-26 Bowman Basketball - Insert - Greatness Loading - Refractor") {
  failures.push({
    error: "COMC structured subset and parallel should outrank broad/misleading matches",
    actual: comcStructuredResponse
  });
}

const autoComcResponse = buildRarityResponse({
  query: "2025-26 Bowman Greatness Loading Autograph Refractor Ace Bailey Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards: [
    {
      canonicalTitle: "2025-26 Bowman Basketball - Autograph - Greatness Loading Autographs - Refractor",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Greatness Loading Autographs Refractor",
        "2025-26 Bowman Autograph"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "greatness", "loading", "autographs", "refractor"],
      serialTerms: [],
      rarityTier: "Autograph",
      scarcityScore: 82,
      printRun: 145,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Autograph",
        setLine: "Greatness Loading Autographs",
        parallel: "Refractor"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (autoComcResponse.title !== "2025-26 Bowman Basketball - Autograph - Greatness Loading Autographs - Refractor") {
  failures.push({
    error: "Autograph query should still match autograph rows",
    actual: autoComcResponse
  });
}

const serialComcResponse = buildRarityResponse({
  query: "2025-26 Bowman - Chrome - Blue Reptilian Refractor #BCV-5 Ace Bailey #/150 Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards: [
    {
      canonicalTitle: "2025-26 Bowman Basketball - Variation - Chrome - Reptilian Refractor",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Chrome Reptilian Refractor"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "chrome", "reptilian", "refractor"],
      serialTerms: [],
      rarityTier: "Variation",
      scarcityScore: 68,
      printRun: 6050,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Variation",
        setLine: "Chrome",
        parallel: "Reptilian Refractor"
      }
    },
    {
      canonicalTitle: "2025-26 Bowman Basketball - Variation - Chrome - Blue Reptilian Refractor",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Chrome Blue Reptilian Refractor /150"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "chrome", "blue", "reptilian", "refractor"],
      serialTerms: ["/150", "150"],
      rarityTier: "Variation",
      scarcityScore: 82,
      printRun: 150,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Variation",
        setLine: "Chrome",
        parallel: "Blue Reptilian Refractor",
        serial: "150"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (serialComcResponse.title !== "2025-26 Bowman Basketball - Variation - Chrome - Blue Reptilian Refractor"
  || serialComcResponse.printRun !== 150) {
  failures.push({
    error: "COMC serial-numbered query should prefer matching serial row",
    actual: serialComcResponse
  });
}

const serialFallbackComcResponse = buildRarityResponse({
  query: "2025-26 Bowman - Chrome - Blue Reptilian Refractor #BCV-5 Ace Bailey #/150 Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards: [
    {
      canonicalTitle: "2025-26 Bowman Basketball - Variation - Chrome - Reptilian Refractor",
      aliases: [
        "2025-26 Bowman Basketball",
        "2025-26 Bowman Chrome Reptilian Refractor"
      ],
      requiredTerms: ["2025", "26", "bowman", "basketball", "chrome", "reptilian", "refractor"],
      serialTerms: [],
      rarityTier: "Variation",
      scarcityScore: 68,
      printRun: 6050,
      packOdds: null,
      popTotal: 0,
      popGem: 0,
      matchMode: "set",
      metadata: {
        year: "2025-26",
        sport: "Basketball",
        brand: "Bowman",
        product: "",
        setType: "Variation",
        setLine: "Chrome",
        parallel: "Reptilian Refractor"
      }
    }
  ],
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (serialFallbackComcResponse.rarityTier !== "Serial Numbered"
  || serialFallbackComcResponse.printRun !== 150) {
  failures.push({
    error: "COMC serial-numbered query should show serial print run even without exact PRV row",
    actual: serialFallbackComcResponse
  });
}

const comcMidnightSerialFallback = buildRarityResponse({
  query: "2025-26 Topps Midnight - [Base] - Morning #62 Dylan Harper #/149 Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (comcMidnightSerialFallback.printRun !== 149
  || comcMidnightSerialFallback.rarityTier === "Unknown") {
  failures.push({
    error: "COMC explicit serial title should surface #/149 in estimated print run",
    actual: comcMidnightSerialFallback
  });
}

const comcGradedSerialFallback = buildRarityResponse({
  query: "2025-26 Topps Now Draft - Online Exclusive [Base] - Orange Foil #D2 Dylan Harper [PSA 9 MINT] #/25 Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (comcGradedSerialFallback.printRun !== 25
  || comcGradedSerialFallback.rarityTier === "Unknown") {
  failures.push({
    error: "COMC graded serial title should ignore grading text and surface #/25",
    actual: comcGradedSerialFallback
  });
}

const comcChromeSerialFallback = buildRarityResponse({
  query: "2025-26 Bowman - Chrome - Refractor #BCV-5 Ace Bailey #240/499 Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (comcChromeSerialFallback.printRun !== 499
  || comcChromeSerialFallback.rarityTier === "Unknown") {
  failures.push({
    error: "COMC explicit serial title should surface #/499 even without exact PRV row",
    actual: comcChromeSerialFallback
  });
}

const comcPlainChromeResponse = buildRarityResponse({
  query: "2025-26 Bowman - Chrome #BCV-5 Ace Bailey Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (comcPlainChromeResponse.rarityTier !== "Unknown"
  || comcPlainChromeResponse.matchMode !== "set"
  || /Chrome Rookie Red RC Logo|Geometric|Bowman Verified/i.test(comcPlainChromeResponse.title)) {
  failures.push({
    error: "COMC plain Chrome listing should not match unrelated specific Bowman rows",
    actual: comcPlainChromeResponse
  });
}

const comcHobbyStarsResponse = buildRarityResponse({
  query: "2025-26 Bowman - Hobby Stars #HS-9 Ace Bailey Basketball",
  source: "comc",
  pageUrl: "https://www.comc.com",
  cards,
  upgradeUrl: "https://chasingmajors.com/upgrade"
});

if (comcHobbyStarsResponse.title !== "2025-26 Bowman Basketball - Insert - Hobby Stars"
  || comcHobbyStarsResponse.printRun !== 27000) {
  failures.push({
    error: "COMC Hobby Stars listing should match the basketball insert row",
    actual: comcHobbyStarsResponse
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
