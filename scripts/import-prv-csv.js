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

  const headers = parseCsvLine(lines[0]).map((header) => normalizeHeader(header));

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {});
  });
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

function listValue(value) {
  return String(value || "")
    .split(/[|;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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
  const year = firstValue(record, ["year", "season"]);
  const brand = firstValue(record, ["brand", "manufacturer"]);
  const product = firstValue(record, ["product", "set", "setname"]);
  const player = firstValue(record, ["player", "playername", "name"]);
  const cardNumber = firstValue(record, ["cardnumber", "cardno", "number"]);
  const team = firstValue(record, ["team"]);
  const parallel = firstValue(record, ["parallel", "variation"]) || "Base";
  const serial = firstValue(record, ["serial", "serialnumber", "numberedto"]);
  const canonicalTitle = firstValue(record, ["canonicaltitle", "title"]) || buildCanonicalTitle(record);
  const rawAliases = listValue(firstValue(record, ["aliases", "alias"]));
  const printRun = numberValue(firstValue(record, ["prv", "printRun", "estimatedprintrun", "estimatedprv"]));

  if (!player || !canonicalTitle) {
    return null;
  }

  return {
    id: slug([year, brand, product, player, cardNumber, parallel, serial].filter(Boolean).join(" ")),
    canonicalTitle,
    aliases: buildAliases({ canonicalTitle, year, brand, product, player, cardNumber, team, parallel, serial, rawAliases }),
    requiredTerms: termsFrom({ player, brand, product, parallel, cardNumber }),
    serialTerms: serial ? [`/${serial.replace(/^\/+/, "")}`, serial.replace(/^\/+/, "")] : cardNumber ? [cardNumber.replace(/^#/, "")] : [],
    rarityTier: firstValue(record, ["raritytier", "tier"]) || (/^base$/i.test(parallel) ? "Base Rookie" : "Rare"),
    scarcityScore: numberValue(firstValue(record, ["scarcityscore", "score"])) ?? (/^base$/i.test(parallel) ? 54 : 75),
    printRun,
    packOdds: firstValue(record, ["packodds", "odds"]) || (/^base$/i.test(parallel) ? "Base card" : null),
    popTotal: numberValue(firstValue(record, ["poptotal", "popcount"])) ?? 0,
    popGem: numberValue(firstValue(record, ["popgem", "gemcount"])) ?? 0
  };
}

const cards = parseCsv(fs.readFileSync(inputPath, "utf8"))
  .map(rowToCard)
  .filter(Boolean);

if (!cards.length) {
  console.error("No cards imported. Check CSV headers and rows.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(cards, null, 2)}\n`);
console.log(`Imported ${cards.length} cards to ${outputPath}`);
