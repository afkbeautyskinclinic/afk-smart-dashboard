# Backend Google Workspace AFK Dashboard

Backend ini disiapkan untuk akun Google Workspace:

`aefkaskincare@gmail.com`

Jangan simpan password email atau API key di file frontend. Semua konfigurasi sensitif disimpan di Script Properties Google Apps Script.

## File Backend

- `Code.gs`: Web App API, setup spreadsheet, sync/fetch data, upload media treatment ke Google Drive, audit log.
- `appsscript.json`: manifest Apps Script dengan timezone dan scope Sheets/Drive yang diperlukan.

## Setup Google Apps Script

1. Login ke Google dengan email `aefkaskincare@gmail.com`.
2. Buka [script.google.com](https://script.google.com).
3. Buat project baru bernama `AFK Beauty Clinic Smart Dashboard Backend`.
4. Buka Project Settings, aktifkan `Show appsscript.json manifest file in editor`.
5. Salin isi `Code.gs` ke file `Code.gs`.
6. Salin isi `appsscript.json` ke file `appsscript.json`.
7. Klik Save.
8. Saat pertama kali menjalankan/deploy versi ini, approve izin Google Drive. Backend akan otomatis membuat folder `AFK Beauty Clinic Smart Dashboard - Treatment Media` untuk foto before-after dan video treatment.

## Buat Database Google Sheets

1. Di editor Apps Script, pilih fungsi `bootstrap`.
2. Klik Run.
3. Berikan izin akses saat diminta.
4. Setelah sukses, jalankan fungsi `getSpreadsheetUrl` untuk melihat URL database Google Sheets.

Sheet yang dibuat:

- `crm`
- `marketing`
- `content`
- `medis`
- `inventory`
- `settings`
- `auditLog`

## Token Keamanan Sederhana

1. Di Apps Script, pilih fungsi `createDashboardToken`.
2. Klik Run.
3. Buka `Executions` atau `View > Logs`, lalu copy token yang muncul.
4. Simpan token itu di sisi frontend pada `CONFIG.GOOGLE_APPS_SCRIPT_TOKEN`.

Alternatif: jika ingin menentukan token sendiri, gunakan Script Properties atau fungsi `setDashboardToken(token)`.

Token ini bukan pengganti autentikasi medis/enterprise, tetapi cukup untuk mencegah endpoint terbuka tanpa sengaja.

## Deploy Web App

1. Klik `Deploy > New deployment`.
2. Pilih type `Web app`.
3. Description: `AFK Dashboard API`.
4. Execute as: `Me (aefkaskincare@gmail.com)`.
5. Who has access: `Anyone`.
6. Klik Deploy.
7. Copy Web App URL.
8. Tempel URL itu ke frontend:

```js
const CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: "WEB_APP_URL_DI_SINI",
  GOOGLE_APPS_SCRIPT_TOKEN: "TOKEN_DI_SINI"
};
```

## Endpoint

Health check:

```text
GET WEB_APP_URL?action=health&token=TOKEN
```

Fetch semua data:

```text
GET WEB_APP_URL?action=fetch&token=TOKEN
```

Sync semua data:

```json
POST WEB_APP_URL
{
  "action": "sync",
  "token": "TOKEN",
  "data": {
    "crm": [],
    "marketing": [],
    "content": [],
    "medis": [],
    "inventory": [],
    "settings": {}
  }
}
```

## Rekomendasi Produksi

- Gunakan akun Google Workspace khusus, bukan akun pribadi staf.
- Batasi akses file Google Sheets hanya untuk Owner/admin.
- Batasi akses folder media treatment di Google Drive sesuai SOP privasi pasien.
- Buat backup berkala Google Sheets.
- Jangan pakai data pasien lengkap sebelum ada SOP privasi, consent, dan kontrol akses.
- Untuk data pasien nyata, pertimbangkan backend autentikasi penuh dan audit akses per user.

