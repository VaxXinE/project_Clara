## Clara Extension

Browser extension ini dipakai sebagai layer operasional Clara di WhatsApp Web.

Target integrasi saat ini:
- membaca chat aktif di WhatsApp Web
- mengirim snapshot chat ke backend Clara
- tetap bisa memakai proxy lokal untuk generate draft balasan

## Konfigurasi env utama

Mulai dari [`.env.example`](./.env.example) lalu isi minimal:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
PORT=9898
PLASMO_PUBLIC_OPENAI_PROXY_URL=http://127.0.0.1:9898/reply-suggestions
PLASMO_PUBLIC_CLARA_API_BASE_URL=http://127.0.0.1:8000
PLASMO_PUBLIC_CLARA_API_TOKEN=isi-dengan-jwt-token-user-clara
```

Catatan:
- `PLASMO_PUBLIC_CLARA_API_BASE_URL` dipakai untuk sync snapshot ke backend Clara
- `PLASMO_PUBLIC_CLARA_API_TOKEN` harus berisi JWT user Clara yang valid, supaya extension bisa auth ke endpoint Clara
- `PLASMO_PUBLIC_OPENAI_PROXY_URL` tetap dipakai untuk reply suggestion sampai engine balasan dipindah penuh ke Clara

### Cara ambil token Clara untuk extension

Karena dashboard Clara sekarang pakai cookie session, bearer token extension diambil dari session login yang sudah valid:

1. Login dulu ke Clara dashboard di browser.
2. Panggil endpoint berikut dari terminal:

```bash
curl -X POST http://127.0.0.1:8000/auth/access-token \
  -H "Cookie: clara_access_token=ISI_COOKIE_LOGIN_ANDA; clara_csrf_token=ISI_CSRF_COOKIE_ANDA" \
  -H "X-CSRF-Token: ISI_CSRF_COOKIE_ANDA"
```

3. Copy field `access_token` dari response.
4. Isi ke `.env` extension:

```env
PLASMO_PUBLIC_CLARA_API_TOKEN=eyJhbGciOi...
```

Untuk local development, ini paling praktis. Untuk production nanti, lebih bagus dibuat flow login extension yang dedicated, supaya user tidak perlu copy token manual.

## WhatsApp AI Reply Flow

Agar user tidak perlu memasukkan OpenAI token di popup extension, project ini sekarang memakai proxy server kecil:

1. Extension membaca chat aktif dari WhatsApp Web.
2. Extension mengirim snapshot chat ke backend Clara kalau `PLASMO_PUBLIC_CLARA_API_BASE_URL` diisi. Kalau belum, extension fallback ke API lokal `/chat-snapshots`.
3. Proxy yang menyimpan `OPENAI_API_KEY` memanggil OpenAI Responses API lewat endpoint `/reply-suggestions`.
4. Proxy mengembalikan 3 saran balasan ke popup.

OpenAI sendiri menyarankan API key tidak diekspos di kode client-side/browser apps.

### Menjalankan proxy

1. Buat file `.env` di root project dengan isi seperti ini:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
PORT=9898
PLASMO_PUBLIC_OPENAI_PROXY_URL=http://127.0.0.1:9898/reply-suggestions
```

Kamu juga bisa mulai dari file [`.env.example`](</d:/Website JS/sg-extension/.env.example>).

2. Jalankan proxy:

```powershell
npm run proxy
```

Kalau muncul error `EADDRINUSE`, artinya port yang dipakai proxy sedang dipakai proses lain. Kamu bisa:

```powershell
Get-NetTCPConnection -LocalPort 9898
Stop-Process -Id <PID>
```

Atau ganti port di file `.env`, misalnya:

```env
PORT=9999
```

Default endpoint proxy:

```text
http://127.0.0.1:9898/reply-suggestions
```

API hasil scraping chat:

```text
POST http://127.0.0.1:9898/chat-snapshots
GET  http://127.0.0.1:9898/chat-snapshots
GET  http://127.0.0.1:9898/chat-snapshots/latest
```

Contoh body untuk menyimpan snapshot hasil scraping:

```json
{
  "chatData": {
    "capturedAt": "2026-05-12T00:00:00.000Z",
    "chatTitle": "Nama Kontak / Grup",
    "chatSubtitle": "online",
    "messages": [
      {
        "id": "10.00-0",
        "author": "Budi",
        "direction": "incoming",
        "text": "Halo",
        "timestampLabel": "10.00"
      }
    ]
  }
}
```

Popup akan otomatis mengirim hasil scraping terbaru ke endpoint ini saat chat dibaca atau berubah.

API ini sekarang menyimpan 1 snapshot terbaru saja, jadi isi response akan selalu mengikuti chat yang terakhir sedang dibuka dan dibaca oleh extension.
Kalau tidak ada chat yang sedang dibuka, extension akan mengosongkan snapshot aktif dan API akan mengembalikan `snapshot: null`.

Response `GET /chat-snapshots` dan `GET /chat-snapshots/latest` akan mengembalikan satu object `snapshot` berisi field chat seperti `capturedAt`, `chatTitle`, `chatSubtitle`, dan `messages`, plus metadata `id` dan `savedAt`.

Health check:

```text
http://127.0.0.1:9898/
http://127.0.0.1:9898/health
```

Kalau dibuka langsung di browser ke `/reply-suggestions`, proxy akan kasih info bahwa endpoint itu memang harus dipanggil dengan method `POST`.
Kalau `OPENAI_API_KEY` belum diisi, endpoint `/chat-snapshots` tetap bisa dipakai, tapi `/reply-suggestions` akan mengembalikan error `503`.

Kalau mau ganti endpoint dari sisi extension, set env ini saat build/dev:

```powershell
$env:PLASMO_PUBLIC_OPENAI_PROXY_URL="https://domain-kamu/reply-suggestions"
```

Catatan:

- File `.env` otomatis dibaca oleh [server/openai-proxy.mjs](</d:/Website JS/sg-extension/server/openai-proxy.mjs>) saat startup.
- Hasil scraping chat disimpan lokal di `server/data/whatsapp-chat-snapshots.json`.
- File `.env` sudah dimasukkan ke [`.gitignore`](</d:/Website JS/sg-extension/.gitignore>) supaya key tidak ikut ter-commit.

## Getting Started

First, run the development server:

```bash
pnpm dev
# or
npm run dev
```

Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.

You can start editing the popup by modifying `popup.tsx`. It should auto-update as you make changes. To add an options page, simply add a `options.tsx` file to the root of the project, with a react component default exported. Likewise to add a content page, add a `content.ts` file to the root of the project, importing some module and do some logic, then reload the extension on your browser.

For further guidance, [visit our Documentation](https://docs.plasmo.com/)

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
