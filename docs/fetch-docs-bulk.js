const https = require("https");
const fs = require("fs");
const path = require("path");

const pages = [
  "introduction",
  "signing",
  "orderIds",
  "changelog",
  "getExchangeInfo",
  "getTicker",
  "getKlines",
  "getL2Book",
  "getStats",
  "getRiskSurfaces",
  "getFeeState",
  "getAccount",
  "getMultisigProposals",
  "placeOrder",
  "manageAgentWallet",
  "updateUserSettings",
  "manageSubAccounts",
  "transfer",
  "manageMultisig",
  "requestFaucet",
  "websocket-intro",
  "ws-market-data",
  "ws-account",
  "ws-multisig",
  "ws-trading",
  "ws-connection",
];

const OUTPUT_DIR = path.join(__dirname, "bulk-trade");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.bulk.trade/api-reference/${page}.md`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            const filePath = path.join(OUTPUT_DIR, `${page}.md`);
            fs.writeFileSync(filePath, data, "utf8");
            console.log(`✅ ${page}.md (${data.length} chars)`);
            resolve({ page, success: true, size: data.length });
          } else {
            console.warn(`⚠️  ${page} — HTTP ${res.statusCode}`);
            resolve({ page, success: false, status: res.statusCode });
          }
        });
      })
      .on("error", (err) => {
        console.error(`❌ ${page} — ${err.message}`);
        resolve({ page, success: false, error: err.message });
      });
  });
}

async function main() {
  console.log(`Fetching ${pages.length} docs from docs.bulk.trade...\n`);
  const results = await Promise.all(pages.map(fetchPage));
  const ok = results.filter((r) => r.success).length;
  const fail = results.filter((r) => !r.success);
  console.log(`\nDone: ${ok}/${pages.length} saved to docs/bulk-trade/`);
  if (fail.length > 0) {
    console.log("Failed:", fail.map((r) => r.page).join(", "));
  }
}

main();
