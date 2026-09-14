/**
 * Inline HTML templates used by the main process.
 *
 * RECOVERY_HTML — fallback page shown when the renderer fails to load.
 * LOADING_HTML  — splash screen shown while the backend starts.
 */
import { APP_NAME } from "./app-state";

// Halaman fallback yang di-load kalau renderer gagal load (mis. backend
// belum siap, port lain dipakai, dst). Tombol di sini panggil IPC yang
// sama dengan menu di atas. User awam tidak perlu tahu cara download
// installer manual.
export const RECOVERY_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aplikasi Bermasalah</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem;
      background: #0d3526; color: white;
      font-family: 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }
    .card {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 12px;
      padding: 2rem; max-width: 540px; width: 100%;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.4rem; }
    .subtitle { font-size: 0.9rem; opacity: 0.8; margin-bottom: 1.25rem; }
    .desc { font-size: 0.95rem; line-height: 1.6; opacity: 0.95; margin-bottom: 1.5rem; }
    .btn-group { display: flex; flex-direction: column; gap: 0.5rem; }
    button {
      width: 100%; padding: 0.75rem 1rem;
      background: white; color: #0d3526;
      border: none; border-radius: 8px;
      font-size: 0.95rem; font-weight: 600;
      cursor: pointer; text-align: left;
      transition: opacity 0.15s;
    }
    button:hover { opacity: 0.9; }
    button.secondary {
      background: transparent; color: white;
      border: 1px solid rgba(255,255,255,0.4);
    }
    button.secondary:hover { background: rgba(255,255,255,0.08); }
    .hint { font-size: 0.8rem; opacity: 0.7; margin-top: 1.25rem; line-height: 1.5; }
    .status {
      margin-top: 0.75rem; padding: 0.6rem 0.75rem;
      background: rgba(0,0,0,0.25); border-radius: 6px;
      font-size: 0.85rem; min-height: 1.2rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠️ Aplikasi Bermasalah</h1>
    <div class="subtitle">Versi: <span id="ver">memuat...</span></div>
    <div class="desc">
      Halaman utama tidak bisa dimuat. Coba salah satu opsi di bawah untuk
      memperbaiki. <strong>Data Anda tidak akan hilang</strong> — semua
      tersimpan terpisah dari aplikasi.
    </div>
    <div class="btn-group">
      <button onclick="reload()">🔄 Coba Muat Ulang</button>
      <button onclick="checkUpdate()">⬇️ Cek &amp; Pasang Update</button>
      <button class="secondary" onclick="openData()">📂 Buka Folder Data</button>
      <button class="secondary" onclick="openReleases()">🌐 Buka Halaman Rilis</button>
      <button class="secondary" onclick="quitApp()">✕ Tutup Aplikasi</button>
    </div>
    <div class="status" id="status">Menu &quot;Aplikasi&quot; di atas juga punya tombol-tombol ini.</div>
    <div class="hint">
      Kalau ini terus terjadi, hubungi support dan kirim folder
      <code>logs/</code> dari folder data di atas.
    </div>
  </div>
  <script>
    const api = window.electronApp || {};
    const $status = document.getElementById('status');
    const $ver = document.getElementById('ver');
    function setStatus(msg) { $status.textContent = msg; }
    if (api.getAppVersion) {
      api.getAppVersion().then(v => { $ver.textContent = v || '-'; }).catch(() => {});
    } else {
      $ver.textContent = '(API tidak tersedia)';
    }
    function reload() { setStatus('Memuat ulang...'); location.reload(); }
    function checkUpdate() {
      if (!api.checkUpdate) { setStatus('API update tidak tersedia.'); return; }
      setStatus('Mengecek update...');
      api.checkUpdate().then((info) => {
        if (info && info.available) {
          setStatus('Update tersedia: v' + info.version + '. Mendownload...');
          api.downloadUpdate().then(() => {
            setStatus('Download selesai. Klik tombol ini lagi untuk pasang.');
            const btn = document.querySelectorAll('button')[1];
            btn.textContent = '⬆️ Pasang & Restart';
            btn.onclick = () => api.installUpdate();
          }).catch(e => setStatus('Gagal download: ' + (e && e.message || e)));
        } else if (info) {
          setStatus('Tidak ada update tersedia (sudah versi terbaru).');
        }
      }).catch(e => setStatus('Gagal cek: ' + (e && e.message || e)));
    }
    function openData() { api.openUserData && api.openUserData(); }
    function openReleases() { api.openReleases && api.openReleases(); }
    function quitApp() { api.quitApp && api.quitApp(); }
  </script>
</body>
</html>`;

export const LOADING_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; align-items: center; justify-content: center;
      height: 100vh;
      background: #0d3526;
      color: white;
      font-family: 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }
    .container { text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 0.75rem; }
    h1 { font-size: 1.75rem; font-weight: 700; }
    .subtitle { font-size: 0.875rem; opacity: 0.7; margin-top: 0.25rem; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.25);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 1.5rem auto 1rem;
    }
    .status { font-size: 0.8rem; opacity: 0.6; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📒</div>
    <h1>${APP_NAME}</h1>
    <div class="subtitle">by KetanTech</div>
    <div class="spinner"></div>
    <div class="status">Memuat aplikasi, harap tunggu...</div>
  </div>
</body>
</html>`;
