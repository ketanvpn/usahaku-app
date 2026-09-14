import { app, safeStorage, shell } from "electron";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET } from "../credentials";
import { writeLog } from "../logging";
import { httpsReq, setGDriveLastError } from "./gdrive-sync";

export interface GDriveTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email: string;
}

function getGDriveTokenPath(): string {
  return path.join(app.getPath("userData"), "gdrive-tokens.dat");
}

export function loadGDriveTokens(): GDriveTokens | null {
  try {
    const tokenPath = getGDriveTokenPath();
    if (!fs.existsSync(tokenPath)) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      writeLog("[gdrive] safeStorage tidak tersedia, tidak bisa baca token terenkripsi.");
      return null;
    }
    const raw = fs.readFileSync(tokenPath);
    return JSON.parse(safeStorage.decryptString(raw)) as GDriveTokens;
  } catch {
    return null;
  }
}

export function saveGDriveTokens(tokens: GDriveTokens): void {
  if (!safeStorage.isEncryptionAvailable()) {
    writeLog("[gdrive] PERINGATAN: safeStorage tidak tersedia, token tidak disimpan. User harus re-auth setiap sesi.");
    return;
  }

  try {
    const encryptedTokens = safeStorage.encryptString(JSON.stringify(tokens));
    fs.writeFileSync(getGDriveTokenPath(), encryptedTokens);
  } catch (error) {
    writeLog(`[gdrive] Gagal simpan tokens: ${error}`);
  }
}

export function clearGDriveTokens(): void {
  try {
    const tokenPath = getGDriveTokenPath();
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  } catch {}
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      client_id: GDRIVE_CLIENT_ID,
      client_secret: GDRIVE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString();
    const response = await httpsReq({
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
    }, body);
    if (response.statusCode !== 200) {
      const errorBody = JSON.parse(response.body.toString("utf8")) as { error?: string };
      if (response.statusCode === 400 && errorBody.error === "invalid_grant") {
        writeLog("[gdrive] Refresh token dicabut. Menghapus token lokal.");
        clearGDriveTokens();
        setGDriveLastError("Akses Google Drive dicabut. Hubungkan ulang.");
      }
      return null;
    }
    return (JSON.parse(response.body.toString("utf8")) as { access_token: string }).access_token;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadGDriveTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiry_date - 60_000) return tokens.access_token;

  const newToken = await refreshAccessToken(tokens.refresh_token);
  if (!newToken) {
    setGDriveLastError("Token kadaluarsa, silakan hubungkan ulang Google Drive");
    return null;
  }
  tokens.access_token = newToken;
  tokens.expiry_date = Date.now() + 3600 * 1000;
  saveGDriveTokens(tokens);
  return newToken;
}

export async function startGDriveOAuthFlow(): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    const server = http.createServer();
    let settled = false;

    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      const redirectUri = `http://127.0.0.1:${port}`;
      const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: GDRIVE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
        access_type: "offline",
        prompt: "consent",
      }).toString();

      shell.openExternal(authUrl);
      writeLog(`[gdrive] OAuth flow dimulai, port=${port}`);
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        server.close();
        resolve({ success: false, message: "Waktu habis (5 menit). Silakan coba lagi." });
      }, 5 * 60 * 1000);

      server.on("request", async (request, response) => {
        const url = new URL(request.url ?? "/", redirectUri);
        if (url.pathname !== "/" && url.pathname !== "") {
          response.writeHead(204).end();
          return;
        }
        if (settled) {
          response.writeHead(204).end();
          return;
        }

        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const html = code
          ? `<!DOCTYPE html><html lang="id"><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#f0fdf4"><h2 style="color:#166534">✅ Berhasil!</h2><p>Google Drive berhasil dihubungkan ke <strong>Usahaku</strong>.</p><p style="color:#6b7280">Anda bisa menutup tab ini dan kembali ke aplikasi.</p></body></html>`
          : `<!DOCTYPE html><html lang="id"><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#fff7f7"><h2 style="color:#991b1b">❌ Dibatalkan</h2><p>Proses dihentikan. Silakan tutup tab ini.</p></body></html>`;
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
        clearTimeout(timeout);
        settled = true;
        server.close();

        if (!code) {
          resolve({ success: false, message: error === "access_denied" ? "Izin ditolak." : "Dibatalkan." });
          return;
        }

        try {
          const tokenBody = new URLSearchParams({
            client_id: GDRIVE_CLIENT_ID,
            client_secret: GDRIVE_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }).toString();
          const tokenResponse = await httpsReq({
            hostname: "oauth2.googleapis.com",
            path: "/token",
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) },
          }, tokenBody);
          if (tokenResponse.statusCode !== 200) {
            writeLog(`[gdrive] Token exchange gagal: ${tokenResponse.body.toString("utf8")}`);
            resolve({ success: false, message: "Gagal mendapatkan token dari Google." });
            return;
          }
          const tokenJson = JSON.parse(tokenResponse.body.toString("utf8")) as { access_token: string; refresh_token: string; expires_in: number };
          let email = "Akun Google";
          const userResponse = await httpsReq({
            hostname: "www.googleapis.com",
            path: "/oauth2/v3/userinfo",
            method: "GET",
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          });
          if (userResponse.statusCode === 200) {
            email = (JSON.parse(userResponse.body.toString("utf8")) as { email?: string }).email ?? email;
          }
          saveGDriveTokens({
            access_token: tokenJson.access_token,
            refresh_token: tokenJson.refresh_token,
            expiry_date: Date.now() + (tokenJson.expires_in || 3600) * 1000,
            email,
          });
          writeLog(`[gdrive] Terhubung sebagai: ${email}`);
          resolve({ success: true });
        } catch (error) {
          writeLog(`[gdrive] OAuth error: ${error}`);
          resolve({ success: false, message: `Terjadi kesalahan: ${error}` });
        }
      });
    });
    server.on("error", (error) => resolve({ success: false, message: `Gagal membuka server lokal: ${error}` }));
  });
}
