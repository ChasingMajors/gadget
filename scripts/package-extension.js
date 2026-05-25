const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const manifest = require(path.join(rootDir, "manifest.json"));
const packageName = `cm-rarity-gadget-v${manifest.version}`;
const distDir = path.join(rootDir, "dist");
const packageDir = path.join(distDir, packageName);
const zipPath = path.join(distDir, `${packageName}.zip`);

const extensionFiles = [
  "manifest.json",
  "background.js",
  "config.js",
  "storage.js",
  "parser.js",
  "api.js",
  "ui.js",
  "content.js",
  "styles.css",
  "icons/cm-logo.png",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png"
];

function copyFile(relativePath) {
  const source = path.join(rootDir, relativePath);
  const destination = path.join(packageDir, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing extension package file: ${relativePath}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

fs.rmSync(packageDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(packageDir, { recursive: true });
extensionFiles.forEach(copyFile);

const result = spawnSync("zip", ["-r", zipPath, "."], {
  cwd: packageDir,
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Packaged ${zipPath}`);
