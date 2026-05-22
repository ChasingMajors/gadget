const fs = require("fs");
const https = require("https");
const http = require("http");
const { spawnSync } = require("child_process");

const sourceUrl = process.env.CM_PRV_CSV_URL || process.argv[2];
const outputPath = process.env.CM_PRV_OUTPUT || process.argv[3] || "backend/data/cards.json";
const tempPath = "/tmp/cm-prv-sync.csv";

if (!sourceUrl) {
  console.error("Missing PRV CSV URL. Set CM_PRV_CSV_URL or pass the URL as the first argument.");
  process.exit(1);
}

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        if (redirects > 5) {
          reject(new Error("Too many redirects while downloading PRV CSV"));
          return;
        }

        resolve(download(new URL(response.headers.location, url).toString(), redirects + 1));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`PRV CSV download returned HTTP ${response.statusCode}`));
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });

    request.on("error", reject);
  });
}

async function main() {
  const csv = await download(sourceUrl);

  if (!csv.includes(",") || /<html[\s>]/i.test(csv.slice(0, 500))) {
    throw new Error("Downloaded PRV source does not look like CSV. Check sharing/publish settings.");
  }

  fs.writeFileSync(tempPath, csv);
  const result = spawnSync(process.execPath, ["scripts/import-prv-csv.js", tempPath, outputPath], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
