/**
 * inject-credentials.js
 * Dijalankan otomatis sebelum `tsc` saat build.
 * Membaca GDRIVE_CLIENT_ID dan GDRIVE_CLIENT_SECRET dari env,
 * lalu menulis nilainya langsung ke src/credentials.ts agar
 * tertanam (baked-in) ke dalam binary .exe.
 */
const fs = require("fs");
const path = require("path");

const clientId = process.env.GDRIVE_CLIENT_ID || "";
const clientSecret = process.env.GDRIVE_CLIENT_SECRET || "";

const content = `// File ini di-generate otomatis oleh scripts/inject-credentials.js
// JANGAN edit manual — nilai akan ditimpa setiap build
// JANGAN commit file ini ke git (lihat .gitignore)
export const GDRIVE_CLIENT_ID = ${JSON.stringify(clientId)};
export const GDRIVE_CLIENT_SECRET = ${JSON.stringify(clientSecret)};
`;

const outPath = path.join(__dirname, "..", "src", "credentials.ts");
fs.writeFileSync(outPath, content, "utf8");

if (clientId && clientSecret) {
  console.log("[inject-credentials] ✅ GDRIVE_CLIENT_ID dan GDRIVE_CLIENT_SECRET berhasil di-inject.");
} else {
  console.log("[inject-credentials] ⚠️  Credentials kosong — fitur Google Drive tidak aktif di binary ini.");
}
