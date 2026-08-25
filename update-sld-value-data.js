const fs = require("fs");
const https = require("https");

const outputPath = "sld-value-data.json";
const sourceUrl = "https://www.manavalue.org/";

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Mana Value returned HTTP ${response.statusCode}.`));
        return;
      }

      let html = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        html += chunk;
      });
      response.on("end", () => resolve(html));
    }).on("error", reject);
  });
}

function extractDataset(html) {
  const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)<\/script>/g)];
  let decoded = "";

  for (const match of pushes) {
    try {
      const value = JSON.parse(`"${match[1]}"`);
      if (value.includes('"tab":"secret-lair"')) {
        decoded = value;
      }
    } catch {
      // Ignore unrelated Next.js payload fragments.
    }
  }

  const marker = '{"tab":"secret-lair","lairs":';
  const start = decoded.indexOf(marker);
  if (start < 0) {
    throw new Error("The Secret Lair dataset was not found in the Mana Value page.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let index = start; index < decoded.length; index += 1) {
    const character = decoded[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error("The Secret Lair dataset was incomplete.");
  }

  return JSON.parse(decoded.slice(start, end));
}

(async () => {
  const html = await download(sourceUrl);
  const data = extractDataset(html);
  if (!Array.isArray(data.lairs) || data.lairs.length === 0) {
    throw new Error("The downloaded dataset did not contain any Secret Lair records.");
  }

  const output = {
    source: sourceUrl,
    fetchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString().slice(0, 10),
    ...data
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Updated ${outputPath} with ${output.lairs.length} Secret Lair drops.`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
