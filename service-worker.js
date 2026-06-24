# Deploy Dashboard ke GitHub Pages

Panduan ini membuat aplikasi bisa dibuka lewat HTTPS dari GitHub Pages, sehingga PWA bisa diinstall di Android dan iPhone.

## Yang Perlu Disiapkan

- Akun GitHub milik klinik atau owner.
- Repository baru, misalnya `afk-beauty-dashboard`.
- Backend Google Apps Script sudah dideploy sebagai Web App.
- Token dari fungsi `createDashboardToken()`.

## Upload ke GitHub

Cara paling aman:

1. Buka GitHub dan buat repository baru.
2. Jangan upload password, credential Gmail, atau data pasien asli.
3. Upload semua file dari folder dashboard ini ke repository.
4. Pastikan branch utama bernama `main`.
5. GitHub Actions akan menjalankan workflow `.github/workflows/pages.yml`.

## Aktifkan GitHub Pages

1. Buka repository GitHub.
2. Masuk `Settings > Pages`.
3. Pada `Build and deployment`, pilih `GitHub Actions`.
4. Tunggu workflow selesai.
5. Buka URL Pages yang muncul, biasanya:

```text
https://USERNAME.github.io/afk-beauty-dashboard/
```

## Hubungkan ke Google Apps Script

1. Buka aplikasi dari URL GitHub Pages.
2. Login sebagai Owner.
3. Buka halaman Settings.
4. Isi:
   - `Google Apps Script Web App URL`
   - `Google Apps Script Token`
5. Klik `Simpan Settings`.
6. Klik `Sync Google Sheets`.
7. Klik `Ambil Data Sheets` untuk memastikan fetch berhasil.

Konfigurasi URL dan token disimpan di LocalStorage browser perangkat tersebut.

## Install di Android

1. Buka URL GitHub Pages di Chrome.
2. Tap tombol install `⇩` di topbar, atau buka menu Chrome.
3. Pilih `Install app` atau `Add to Home screen`.

## Install di iPhone

1. Buka URL GitHub Pages di Safari.
2. Tap tombol `Share`.
3. Pilih `Add to Home Screen`.
4. Buka dashboard dari icon di Home Screen.

## Catatan Keamanan

GitHub Pages adalah hosting frontend publik. Jangan commit token rahasia, password Gmail, atau data pasien asli ke repository.

Jika dashboard akan dipakai untuk data pasien nyata, gunakan:

- Akun Google Workspace khusus klinik.
- 2-Step Verification.
- Akses Google Sheets dibatasi untuk owner/admin.
- SOP privasi data pasien.
- Backup rutin.
