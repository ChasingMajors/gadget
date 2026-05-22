const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const errors = [];
const warnings = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    errors.push(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function assertFile(file, message = `${file} is missing`) {
  if (!exists(file)) {
    errors.push(message);
  }
}

function collectManifestFiles(manifest) {
  const files = new Set();

  Object.values(manifest.icons || {}).forEach((file) => files.add(file));

  if (manifest.background?.service_worker) {
    files.add(manifest.background.service_worker);
  }

  (manifest.content_scripts || []).forEach((script) => {
    (script.js || []).forEach((file) => files.add(file));
    (script.css || []).forEach((file) => files.add(file));
  });

  (manifest.web_accessible_resources || []).forEach((resource) => {
    (resource.resources || []).forEach((file) => files.add(file));
  });

  return files;
}

function checkManifest(manifest) {
  if (!manifest) {
    return;
  }

  if (manifest.manifest_version !== 3) {
    errors.push("manifest.json must use Manifest V3");
  }

  if (!manifest.name || !manifest.version || !manifest.description) {
    errors.push("manifest.json needs name, version, and description");
  }

  if (!manifest.permissions?.includes("storage")) {
    errors.push("manifest.json must include storage permission for freemium state");
  }

  const hostPermissions = manifest.host_permissions || [];
  ["https://www.ebay.com/*", "https://www.comc.com/*", "https://api.chasingmajors.com/*"].forEach((permission) => {
    if (!hostPermissions.includes(permission)) {
      errors.push(`manifest.json is missing host permission ${permission}`);
    }
  });

  collectManifestFiles(manifest).forEach((file) => assertFile(file));
}

function checkConfig() {
  const configPath = path.join(root, "config.js");
  const config = fs.readFileSync(configPath, "utf8");

  if (!config.includes('API_BASE_URL: "https://api.chasingmajors.com"')) {
    if (!config.includes('PRODUCTION_API_BASE_URL: "https://api.chasingmajors.com"')) {
      warnings.push("config.js does not reference the production Chasing Majors API");
    }

    warnings.push("config.js API_BASE_URL is set to an MVP/staging API. Point it to production before Chrome Web Store submission.");
  }

  if (config.includes("MVP_ADMIN_MODE: true")) {
    warnings.push("MVP_ADMIN_MODE is enabled. This is okay for internal trials, but turn it off before Chrome Web Store submission.");
  }
}

function checkRequiredFiles() {
  [
    "README.md",
    "MVP_TRIAL_PLAN.md",
    "background.js",
    "config.js",
    "api.js",
    "content.js",
    "parser.js",
    "ui.js",
    "storage.js",
    "styles.css",
    "dev/harness.html",
    "backend/README.md",
    "backend/server.js",
    "backend/lib/matcher.js",
    "backend/data/cards.json",
    "scripts/validate-api.js",
    "scripts/validate-parser.js",
    "scripts/generate-icons.js"
  ].forEach((file) => assertFile(file));
}

const manifest = readJson("manifest.json");
checkManifest(manifest);
checkConfig();
checkRequiredFiles();

if (warnings.length) {
  console.warn("Warnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (errors.length) {
  console.error("Errors:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("CM Rarity Gadget validation passed.");
