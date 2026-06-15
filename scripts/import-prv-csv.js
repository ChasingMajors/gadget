const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "backend/data/cards.json";

if (!inputPath) {
  console.error("Usage: node scripts/import-prv-csv.js <input.csv> [output.json]");
  process.exit(1);
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value);
  return values.map((entry) => entry.trim());
}

function parseCsv(raw) {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map((header) => normalizeHeader(header));

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {});
  });

  return {
    rawHeaders,
    headers,
    rows
  };
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function firstValue(record, names) {
  for (const name of names.map(normalizeHeader)) {
    if (record[name]) {
      return record[name].trim();
    }
  }
  return "";
}

function numberValue(value) {
  const cleaned = String(value || "").replace(/[$,%\s,]/g, "");
  if (!cleaned) {
    return null;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function serialValue(value) {
  const match = String(value || "").match(/([\d,]{1,9})/);
  if (!match) {
    return "";
  }

  return match[1].replace(/,/g, "");
}

function serialText(value) {
  const serial = serialValue(value);
  return serial ? `/${serial}` : "";
}

function listValue(value) {
  return String(value || "")
    .split(/[|;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function compactList(values, { maxEntries = 12, maxLength = 160 } = {}) {
  return Array.from(new Set(values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => value.length <= maxLength)))
    .slice(0, maxEntries);
}

function compactCard(card) {
  const compacted = { ...card };
  if (compacted.matchMode === "set") {
    delete compacted.aliases;
  } else {
    compacted.aliases = compactList(compacted.aliases, { maxEntries: 4, maxLength: 100 });
  }
  compacted.requiredTerms = compactList(compacted.requiredTerms, { maxEntries: 10, maxLength: 20 })
    .filter((term) => !/[0-9]{4,}/.test(term));

  if (!compacted.serialTerms?.length) delete compacted.serialTerms;
  if (compacted.sourceUrl === null || compacted.sourceUrl === "") delete compacted.sourceUrl;
  if (compacted.popTotal === 0) delete compacted.popTotal;
  if (compacted.popGem === 0) delete compacted.popGem;

  if (compacted.metadata) {
    compacted.metadata = { ...compacted.metadata };
    delete compacted.metadata.subsetSize;
  }

  return compacted;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function termsFrom({ player, brand, product, parallel, cardNumber }) {
  const terms = [];

  player.split(/\s+/).forEach((term) => terms.push(term));
  if (brand) terms.push(brand);
  if (product && product.toLowerCase() !== brand.toLowerCase()) terms.push(product);
  if (parallel && !/^base$/i.test(parallel)) terms.push(parallel);
  if (cardNumber) terms.push(cardNumber.replace(/^#/, ""));

  return Array.from(new Set(terms
    .map((term) => term.toLowerCase().replace(/[^a-z0-9/]+/g, ""))
    .filter((term) => term.length > 1)));
}

function hasExplicitTitle(record) {
  return Boolean(firstValue(record, ["canonicaltitle", "title", "card", "cardtitle", "cardname", "description"]));
}

function packOddsText(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  return /(?:^|\b)1\s*:\s*[\d,]+/i.test(text) || /^base card$/i.test(text) ? text : "";
}

function packOddsValue(record) {
  return firstValue(record, ["packodds", "pack odds", "odds"])
    || packOddsText(firstValue(record, ["notes"]));
}

function hasSetSchema(record) {
  return Boolean(firstValue(record, ["displayname"])
    && (firstValue(record, [
      "printrun",
      "print run",
      "pr",
      "prv",
      "estimatedprintrun",
      "estimated print run",
      "estimatedpr",
      "estimatedprv",
      "calculatedprintrun",
      "calculated print run",
      "calculatedpr"
    ])
      || firstValue(record, ["serial", "serialnumber", "numberedto"])
      || packOddsValue(record)));
}

function titleTerms(title) {
  const stopTerms = new Set([
    "the",
    "and",
    "with",
    "rookie",
    "card",
    "cards",
    "base",
    "pre",
    "owned",
    "psa",
    "bgs",
    "sgc",
    "gem",
    "mint"
  ]);

  return Array.from(new Set(String(title || "")
    .toLowerCase()
    .replace(/\bx[\s-]?fractors?\b/g, " xfractors ")
    .replace(/[#(),.:;!?'"[\]{}|\\]/g, " ")
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9/]+/g, ""))
    .filter((term) => term.length > 1)
    .filter((term) => !stopTerms.has(term))));
}

function buildCanonicalTitle(record) {
  const year = firstValue(record, ["year", "season"]);
  const brand = firstValue(record, ["brand", "manufacturer"]);
  const product = firstValue(record, ["product", "set", "setname"]);
  const player = firstValue(record, ["player", "playername", "name"]);
  const cardNumber = firstValue(record, ["cardnumber", "cardno", "number"]);
  const parallel = firstValue(record, ["parallel", "variation"]);
  const serial = firstValue(record, ["serial", "serialnumber", "numberedto"]);

  return [
    year,
    brand,
    product,
    player,
    cardNumber ? `#${cardNumber.replace(/^#/, "")}` : "",
    parallel && !/^base$/i.test(parallel) ? parallel : "",
    serial ? `/${serial.replace(/^\/+/, "")}` : "",
    "RC"
  ].filter(Boolean).join(" ").replace(/\s+\/(\d+)/, " /$1");
}

function setRowToCard(record) {
  const code = firstValue(record, ["code"]);
  const displayName = firstValue(record, ["displayname"]);
  const year = firstValue(record, ["year", "season"]);
  const sport = firstValue(record, ["sport"]);
  const brand = firstValue(record, ["manufacturer", "brand"]);
  const product = firstValue(record, ["product", "set", "setname"]);
  const setType = firstValue(record, ["settype"]);
  const setLine = firstValue(record, ["setline"]);
  const parallel = firstValue(record, ["parallel", "variation"]);
  const printRun = numberValue(firstValue(record, [
    "printrun",
    "print run",
    "pr",
    "prv",
    "estimatedprintrun",
    "estimated print run",
    "estimatedpr",
    "estimatedprv",
    "calculatedprintrun",
    "calculated print run",
    "calculatedpr"
  ]));
  const serial = firstValue(record, ["serial", "serialnumber", "numberedto"]);
  const normalizedSerial = serialText(serial);
  const serialPrintRun = numberValue(serialValue(serial));
  const effectivePrintRun = printRun ?? serialPrintRun;
  const subsetSize = numberValue(firstValue(record, ["subsetsize"]));
  const rawKeywords = listValue(firstValue(record, ["keywords"]));
  const packOdds = packOddsValue(record);
  const cmURL = firstValue(record, ["cmurl"]);

  if (!displayName || (effectivePrintRun === null && !packOdds)) {
    return null;
  }

  const titleParts = [
    displayName,
    setType,
    setLine && !setType.toLowerCase().includes(setLine.toLowerCase()) ? setLine : "",
    parallel
  ].filter(Boolean);
  const canonicalTitle = Array.from(new Set(titleParts)).join(" - ");
  const requiredTerms = Array.from(new Set([
    ...titleTerms(displayName),
    ...titleTerms(setLine),
    ...titleTerms(parallel),
    ...rawKeywords.map((keyword) => keyword.toLowerCase().replace(/[^a-z0-9/]+/g, "")).filter(Boolean)
  ].filter((term) => term.length <= 48))).slice(0, 12);

  return {
    id: slug(canonicalTitle),
    canonicalTitle,
    aliases: compactList([
      displayName,
      canonicalTitle,
      [year, brand, product, setLine, parallel, normalizedSerial].filter(Boolean).join(" "),
      [year, brand, product, setType].filter(Boolean).join(" "),
      [year, brand, product, parallel].filter(Boolean).join(" "),
      ...rawKeywords
    ]),
    requiredTerms,
    serialTerms: normalizedSerial ? [normalizedSerial, normalizedSerial.slice(1)] : [],
    rarityTier: setType || "Product",
    scarcityScore: effectivePrintRun === null ? 62 : effectivePrintRun <= 1000 ? 82 : effectivePrintRun <= 10000 ? 68 : 54,
    printRun: effectivePrintRun,
    packOdds: packOdds || null,
    popTotal: 0,
    popGem: 0,
    matchMode: "set",
    sourceUrl: cmURL || null,
    metadata: {
      year,
      code: code && code !== "#N/A" ? code : "",
      sport,
      brand,
      product,
      setType,
      setLine,
      parallel,
      serial: normalizedSerial ? normalizedSerial.slice(1) : "",
      subsetSize
    }
  };
}

function buildAliases({ canonicalTitle, year, brand, product, player, cardNumber, team, parallel, serial, rawAliases }) {
  const number = cardNumber ? cardNumber.replace(/^#/, "") : "";
  const serialText = serial ? `/${serial.replace(/^\/+/, "")}` : "";
  const baseAlias = [
    year,
    brand,
    "NBA Flagship",
    "Basketball",
    player,
    "RC Rookie",
    number ? `#${number}` : "",
    team,
    parallel || "Base",
    serialText
  ].filter(Boolean).join(" ").replace(/\s+\/(\d+)/, " /$1");

  return Array.from(new Set([
    canonicalTitle,
    baseAlias,
    [year, brand, product, player, number ? `#${number}` : "", parallel, serialText].filter(Boolean).join(" ").replace(/\s+\/(\d+)/, " /$1"),
    `${player} ${number} RC`.trim(),
    ...rawAliases
  ].filter(Boolean)));
}

function rowToCard(record) {
  if (hasSetSchema(record)) {
    return setRowToCard(record);
  }

  const year = firstValue(record, ["year", "season"]);
  const brand = firstValue(record, ["brand", "manufacturer"]);
  const product = firstValue(record, ["product", "set", "setname"]);
  const player = firstValue(record, ["player", "playername", "name"]);
  const cardNumber = firstValue(record, ["cardnumber", "cardno", "number"]);
  const team = firstValue(record, ["team"]);
  const parallel = firstValue(record, ["parallel", "variation"]) || "Base";
  const serial = firstValue(record, ["serial", "serialnumber", "numberedto"]);
  const explicitTitle = firstValue(record, ["canonicaltitle", "title", "card", "cardtitle", "cardname", "description"]);
  const canonicalTitle = explicitTitle || buildCanonicalTitle(record);
  const rawAliases = listValue(firstValue(record, ["aliases", "alias"]));
  const printRun = numberValue(firstValue(record, ["prv", "printRun", "estimatedprintrun", "estimatedprv"]));

  if (!canonicalTitle || (!player && !hasExplicitTitle(record))) {
    return null;
  }

  if (!explicitTitle && (!year || !brand || !player)) {
    return null;
  }

  const requiredTerms = player
    ? termsFrom({ player, brand, product, parallel, cardNumber })
    : titleTerms(canonicalTitle).slice(0, 8);

  return {
    id: slug([year, brand, product, player || canonicalTitle, cardNumber, parallel, serial].filter(Boolean).join(" ")),
    canonicalTitle,
    aliases: buildAliases({ canonicalTitle, year, brand, product, player, cardNumber, team, parallel, serial, rawAliases }),
    requiredTerms,
    serialTerms: serial ? [`/${serial.replace(/^\/+/, "")}`, serial.replace(/^\/+/, "")] : cardNumber ? [cardNumber.replace(/^#/, "")] : [],
    rarityTier: firstValue(record, ["raritytier", "tier"]) || (/^base$/i.test(parallel) ? "Base Rookie" : "Rare"),
    scarcityScore: numberValue(firstValue(record, ["scarcityscore", "score"])) ?? (/^base$/i.test(parallel) ? 54 : 75),
    printRun,
    packOdds: packOddsValue(record) || (/^base$/i.test(parallel) ? "Base card" : null),
    popTotal: numberValue(firstValue(record, ["poptotal", "popcount"])) ?? 0,
    popGem: numberValue(firstValue(record, ["popgem", "gemcount"])) ?? 0
  };
}

const parsed = parseCsv(fs.readFileSync(inputPath, "utf8"));
const cards = parsed.rows
  .map(rowToCard)
  .filter(Boolean)
  .map(compactCard);

if (!cards.length) {
  console.error("No cards imported. Check CSV headers and rows.");
  console.error(`Detected headers: ${parsed.rawHeaders.join(" | ")}`);
  if (parsed.rows[0]) {
    const sample = Object.fromEntries(Object.entries(parsed.rows[0]).slice(0, 12));
    console.error(`First row sample: ${JSON.stringify(sample)}`);
  }
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(cards)}\n`);
console.log(`Imported ${cards.length} cards to ${outputPath}`);
