# AFK Beauty Clinic Smart Dashboard

Aplikasi dashboard statis untuk klinik kecantikan AFK Beauty Skin Clinic. Aplikasi ini memakai HTML, CSS, JavaScript, Chart.js, dan LocalStorage sehingga bisa langsung dijalankan dengan membuka `index.html`.

## 1. Cara menjalankan aplikasi

1. Buka file `index.html` di browser Chrome, Edge, Safari, atau browser mobile.
2. Pilih role pada dropdown di topbar.
3. Masukkan password demo:
   - Owner: `owner123`
   - CRM: `crm123`
   - Digital Marketing: `marketing123`
   - Design Content: `design123`
   - Medis: `medis123`
   - Inventory: `inventory123`

Chart.js dimuat dari CDN, jadi grafik akan tampil sempurna saat perangkat memiliki koneksi internet. Data aplikasi tetap tersimpan lokal di browser.

Untuk mode install/PWA, buka aplikasi melalui server lokal atau hosting HTTPS, bukan langsung dari `file://`.

Cara paling mudah di Windows:

1. Klik dua kali `start-localhost.bat`.
2. Browser akan membuka `http://localhost:8080`.

Contoh server lokal gratis dari folder aplikasi jika ingin menjalankan manual:

```bash
python -m http.server 8080
```

Lalu buka:

```text
http://localhost:8080
```

## Install di Android dan iPhone

Android:

1. Buka URL aplikasi melalui Chrome atau Edge.
2. Tap tombol install `⇩` di topbar, atau buka menu browser.
3. Pilih `Install app` atau `Add to Home screen`.

iPhone:

1. Buka URL aplikasi melalui Safari.
2. Tap tombol `Share`.
3. Pilih `Add to Home Screen`.
4. Simpan, lalu buka dari icon di Home Screen.

Catatan: PWA install membutuhkan `localhost` atau HTTPS. Jika aplikasi dibuka langsung dari file explorer (`file://`), mode install dan offline cache tidak aktif, tetapi dashboard tetap bisa dipakai.

## 2. Alur kerja aplikasi

- Owner bisa melihat seluruh dashboard dan mengisi Catatan Owner pada tabel utama.
- Role divisi bisa melihat semua dashboard kecuali Dashboard Owner.
- Role divisi hanya bisa input dan hapus data pada dashboard divisinya sendiri.
- Semua data demo disimpan di LocalStorage browser.
- Search global di topbar memfilter data tabel pada halaman aktif.

## 3. Struktur file

- `index.html`: struktur aplikasi, topbar, sidebar, panel halaman, modal login.
- `style.css`: desain premium responsive, warna brand, card UI, tabel, form, mobile navigation.
- `script.js`: dummy data, LocalStorage, role access, kalkulasi KPI, render tabel, Chart.js, export, placeholder Google Sheets.
- `assets/logo-afk.png`: logo dan favicon aplikasi.
- `README.md`: dokumentasi penggunaan dan pengembangan.

## 4. Cara mengganti dummy data

Ada dua cara:

- Melalui aplikasi: login sesuai role divisi, lalu input data dari form dashboard divisi.
- Melalui kode: buka `script.js`, cari fungsi `defaultState()`, lalu ubah array `crm`, `marketing`, `content`, `medis`, atau `inventory`.

Untuk mengulang data awal, buka Settings lalu klik `Reset Dummy Data`.

## 5. Cara export CSV dan PDF

- CSV: klik tombol `Export CSV` pada tabel atau halaman Reports.
- PDF: buka halaman Reports, klik `Export PDF / Print`, lalu pilih `Save as PDF` dari dialog print browser.

## 6. Cara mengembangkan ke Google Sheets / Apps Script

Di `script.js` sudah tersedia:

```js
const CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: ""
};

async function syncToGoogleSheets() {}
async function fetchFromGoogleSheets() {}
```

Langkah pengembangan:

1. Buat Google Apps Script sebagai Web App.
2. Buat endpoint `doPost(e)` untuk menerima JSON dari dashboard.
3. Buat endpoint `doGet(e)` untuk mengembalikan data sheet dalam format JSON.
4. Isi `GOOGLE_APPS_SCRIPT_URL` dengan URL Web App.
5. Jangan simpan API key, password asli, atau credential rahasia di frontend.

## 7. Catatan keamanan data pasien

Versi ini adalah demo/offline prototype. Data pasien yang dimasukkan tersimpan di LocalStorage browser dan belum terenkripsi. Untuk penggunaan operasional nyata, gunakan autentikasi server-side, akses berbasis akun, audit log, enkripsi, backup, dan kebijakan privasi yang sesuai.

## 8. Rekomendasi pengembangan berikutnya

- Integrasi Google Sheets real-time via Apps Script.
- Login aman dengan backend atau identity provider.
- Edit data inline untuk setiap divisi.
- Filter tanggal lanjutan pada Reports.
- Import CSV.
- Backup otomatis dan dashboard audit aktivitas.
- PWA installable dengan service worker agar lebih nyaman dipakai di Android dan iPhone.

## Backend Google Workspace

Paket backend Google Apps Script sudah tersedia di folder:

`backend/google-apps-script/`

Gunakan akun Google Workspace `aefkaskincare@gmail.com` untuk membuat dan deploy backend.

File penting:

- `backend/google-apps-script/Code.gs`: API Web App, setup Google Sheets, sync/fetch data, token, audit log.
- `backend/google-apps-script/appsscript.json`: manifest Apps Script.
- `backend/google-apps-script/DEPLOYMENT.md`: panduan deployment step-by-step.
- `backend/google-apps-script/SHEETS_SCHEMA.md`: struktur tabel Google Sheets.

Setelah deploy Web App, isi konfigurasi di `script.js`:

```js
const CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: "URL_WEB_APP_GOOGLE_APPS_SCRIPT",
  GOOGLE_APPS_SCRIPT_TOKEN: "TOKEN_DARI_createDashboardToken"
};
```

Lalu gunakan tombol `Sync Google Sheets` dan `Ambil Data Sheets` di halaman Settings.
