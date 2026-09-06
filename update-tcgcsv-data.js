const fs = require("fs");
const https = require("https");

const outputPath = "tcgcsv-prices.json";
const categoryId = 1;
const groupIds = [2576, 17667];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SLD-Value-Updater/1.0)"
      }
    }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`TCGCSV returned HTTP ${response.statusCode}.`));
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        body += chunk;
      });
      response.on("end", () => resolve(JSON.parse(body)));
    }).on("error", reject);
  });
}

(async () => {
  const prices = {};
  for (const groupId of groupIds) {
    const url = `https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/prices`;
    const payload = await download(url);
    prices[groupId] = Array.isArray(payload) ? payload : payload.results || payload.data || [];
  }

  fs.writeFileSync(outputPath, JSON.stringify({ fetchedAt: new Date().toISOString(), prices }, null, 2));
  console.log(`Updated ${outputPath} for ${groupIds.length} TCGCSV groups.`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
