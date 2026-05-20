---
name: bulk-grid-bot
description: Daftar periksa audit, setup awal, dan pengetahuan lengkap proyek untuk Bulk Grid Trading Bot. Gunakan saat memulai sesi baru, mengaudit kode, men-debug masalah trading, atau menambahkan fitur.
---

# Bulk Grid Trading Bot — Basis Pengetahuan Agen

## Daftar Periksa Awal (Sebelum Menyentuh Kode)

Jalankan ini setiap kali membuka proyek dari awal:

```bash
# 1. Verifikasi DB sudah tersedia
pnpm --filter @workspace/db run push

# 2. Pastikan kedua workflow berjalan
# - artifacts/api-server: API Server  → port 8080
# - artifacts/grid-bot: web           → port 24830

# 3. Typecheck semua paket
pnpm run typecheck
```

Jika `DATABASE_URL` tidak ada, Replit akan menyediakannya secara otomatis — buka tab Database untuk membuat instance PostgreSQL.

---

## Arsitektur

```
Browser (React + Vite, port 24830)
  │
  ├─ Private key: HANYA di localStorage("bulk_private_key") — JANGAN dikirim ke backend
  ├─ Menandatangani order di sisi klien (Ed25519 via tweetnacl)
  ├─ Menempatkan order via WebSocket + REST → proxy /api/*
  │
  └─ API Server (Express 5, port 8080)
       ├─ /api/bots          CRUD konfigurasi bot (PostgreSQL via Drizzle)
       ├─ /api/markets/*     Proxy → https://staging-api.bulk.trade/api/v1
       ├─ /api/order         Proxy → pengiriman order bulk.trade
       ├─ /api/cancel        Proxy → pembatalan bulk.trade
       └─ /api/account       Proxy → data akun bulk.trade
```

**Batasan utama**: Penandatanganan dan penempatan order sepenuhnya di sisi klien. Backend hanya menyimpan konfigurasi/status. Jangan pernah memindahkan logika penandatanganan ke server.

---

## Peta File Kritis

| File | Tujuan |
|------|--------|
| `lib/api-spec/openapi.yaml` | Kontrak API — sumber kebenaran. Edit di sini, lalu jalankan codegen |
| `lib/db/src/schema/bots.ts` | Skema DB: tabel `bots`, `bot_orders` |
| `artifacts/api-server/src/routes/bots.ts` | CRUD bot + route start/stop/stats |
| `artifacts/api-server/src/routes/markets.ts` | Proxy info exchange + ticker |
| `artifacts/grid-bot/src/lib/gridEngine.ts` | Kalkulasi level grid (LONG/SHORT/NEUTRAL) |
| `artifacts/grid-bot/src/lib/botRunner.ts` | Siklus hidup bot: tempatkan order, fill WS, isi ulang |
| `artifacts/grid-bot/src/lib/signing.ts` | Penandatanganan Ed25519 (encoding binary + JSON) |
| `artifacts/grid-bot/src/lib/keys.ts` | Turunkan pubkey dari private key (tweetnacl) |
| `artifacts/grid-bot/src/pages/bots/create.tsx` | Form buat bot |
| `artifacts/grid-bot/src/pages/bots/edit.tsx` | Form edit bot |
| `artifacts/grid-bot/src/pages/bots/detail.tsx` | Detail bot + visualisasi grid + start/stop |
| `artifacts/grid-bot/src/pages/logs.tsx` | Log trading real-time per bot (menggantikan halaman markets) |
| `artifacts/grid-bot/src/pages/dashboard.tsx` | Dashboard dengan session P&L dari fills |

---

## Alur Kerja Codegen

Setelah mengedit `lib/api-spec/openapi.yaml`:
```bash
pnpm --filter @workspace/api-spec run codegen
```
Ini akan meregenerasi:
- `lib/api-client-react/src/generated/api.ts` — hook React Query
- `lib/api-zod/src/generated/api.ts` — skema validasi Zod

Setelah mengedit skema DB (`lib/db/src/schema/bots.ts`):
```bash
pnpm --filter @workspace/db run push
# Lalu typecheck libs sebelum paket leaf:
pnpm run typecheck:libs
```

---

## Hal Penting Bulk.trade API

### Penandatanganan (KRITIS — audit ini dulu)
- Nonce harus dalam **nanodetik**: `BigInt(Date.now()) * 1_000_000n`
- Flag `i` (isolated margin) **wajib** pada semua order action — baik JSON maupun binary
- Encoding binary Ed25519: lihat `docs/bulk-trade/signing.md`
- Field JSON faucet adalah `u` (bukan `user` atau `amount`): `{ faucet: { u: "pubkey" } }`
- Binary faucet: `[u32 discriminant=16][32 bytes user pubkey][1 byte amount tag]`

### Endpoint
- Selalu gunakan **staging**: `https://staging-api.bulk.trade/api/v1`
- WebSocket: `wss://staging-ws.bulk.trade`
- Semua request melalui proxy `/api` untuk menghindari CORS — jangan pernah memanggil bulk.trade langsung dari browser

### Stream Akun WebSocket
Format subscribe:
```json
{ "method": "subscribe", "subscription": [{ "type": "account", "user": "PUBKEY" }] }
```
Struktur pesan — semua pembaruan dibungkus:
```json
{ "type": "account", "data": { "type": "fill|orderUpdate|marginUpdate|...", ... } }
```
Field event fill: `symbol`, `orderId`, `price`, `size`, `fee`, `isBuy`, `reasonCode`, `maker`, `timestamp`

⚠️ **Ambiguitas `isBuy`**: Dokumentasi mendefinisikannya sebagai "true jika taker membeli". Untuk resting BUY limit order kita (maker), saat taker menjual ke kita, `isBuy` mungkin bernilai `false`. Verifikasi dengan fill live di staging sebelum mengandalkan arah session P&L.

Field compact orderUpdate: `sym` (bukan `symbol`), `fillSz`, `origSz` **(bertanda: negatif=jual)**, `sz`, `px`, `oid`, `status`

---

## Logika Grid Bot

### Kalkulasi Grid (`gridEngine.ts`)
```
langkah = (upperPrice - lowerPrice) / gridCount
level[i] = lowerPrice + i * langkah  (i dari 0 sampai gridCount, inklusif)
LONG:    tempatkan BUY hanya di bawah harga saat ini
SHORT:   tempatkan SELL hanya di atas harga saat ini
NEUTRAL: tempatkan BUY di bawah, SELL di atas harga saat ini
```

### Ukuran Order
```
ukuran = (investasi * leverage / gridCount) / harga
```

### Siklus Hidup Bot — Mode UPFRONT
1. Ambil mark price dari `/api/markets/:symbol/ticker`
2. Batalkan semua order yang ada untuk simbol tersebut
3. Tempatkan limit order di semua N level grid sekaligus:
   - LONG: BUY di setiap level **di bawah** harga saat ini
   - SHORT: SELL di setiap level **di atas** harga saat ini
   - NEUTRAL: BUY di bawah, SELL di atas
4. Hubungkan stream akun WebSocket
5. Pantau SL/TP saja — tidak ada pengisian ulang (⚠️ celah P1 yang diketahui — lihat `audit-botRunner.md`)

### Siklus Hidup Bot — Mode REACTIVE (default)
1. Ambil mark price → tetapkan level baseline
2. Batalkan semua order yang ada
3. Hubungkan stream akun WebSocket
4. Mulai price poller (interval 5 detik)
5. Saat crossing level NAIK (harga bergerak ke band lebih tinggi) → tempatkan order BUY resting di level yang dilewati (di bawah current)
6. Saat crossing level TURUN (harga bergerak ke band lebih rendah) → tempatkan order SELL resting di level yang dilewati (di atas current)
7. SL/TP diperiksa setiap tick sebelum logika crossing

⚠️ **Celah P1 yang diketahui**: Order BUY dan SELL mendarat di batas harga yang sama (level N base) untuk band yang sama. Pantulan 1 level yang ketat menghasilkan profit nol (hanya membayar biaya). Pengisian ulang berbasis fill (lihat spesifikasi di bawah dan `audit-botRunner.md`) BELUM diimplementasikan.

### Spesifikasi pengisian ulang berbasis fill (belum diimplementasikan)
Sesuai spesifikasi — ini adalah perilaku yang benar dan harus ditambahkan:
- **BUY terisi di harga P** → tempatkan SELL di `snapToGridLevel(P + gridSpacing)` (satu level di atas)
- **SELL terisi di harga P** → tempatkan BUY di `snapToGridLevel(P - gridSpacing)` (satu level di bawah)
- Ini menjamin profit = spacing × ukuran − biaya per round trip

---

## Session P&L

`BotRunner` melacak session P&L hanya dari fills. Reset ke 0 setiap `start()`.

```typescript
sessionPnl = sessionSellValue − sessionBuyValue − sessionFees
// di mana:
// sessionSellValue = Σ(harga fill SELL × ukuran fill)
// sessionBuyValue  = Σ(harga fill BUY × ukuran fill)
// sessionFees      = Σ(biaya per fill)
```

Jangan gunakan `margin.realizedPnl` dari exchange untuk P&L per-bot — itu adalah total akun historis sejak akun dibuat dan tidak pernah reset per sesi bot.

---

## Skema Database

```sql
bots (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  mode          ENUM('LONG','SHORT','NEUTRAL') NOT NULL,
  order_mode    ENUM('UPFRONT','REACTIVE') NOT NULL DEFAULT 'REACTIVE',
  lower_price   REAL NOT NULL,
  upper_price   REAL NOT NULL,
  grid_count    INT NOT NULL,
  investment    REAL NOT NULL,
  leverage      INT DEFAULT 1,
  stop_loss     REAL,           -- null = dinonaktifkan
  take_profit   REAL,           -- null = dinonaktifkan
  account_pubkey TEXT NOT NULL,
  status        ENUM('IDLE','RUNNING','STOPPED','ERROR') DEFAULT 'IDLE',
  total_pnl     REAL,           -- TIDAK diperbarui live; gunakan sessionPnl dari BotRunner
  total_trades  INT,            -- TIDAK diperbarui live; gunakan runner.totalTrades
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
)
```

Siklus hidup status: `IDLE` (baru dibuat) → `RUNNING` (saat start) → `STOPPED` (saat stop) | `ERROR`.

---

## Bug Umum & Perbaikan (Historis)

| Bug | Penyebab | Perbaikan |
|-----|----------|-----------|
| `bots?.filter is not a function` | React Query mengembalikan non-array saat render pertama | `Array.isArray(bots) ? bots : []` |
| Harga grid melompat liar (mis. 76→3945→7814) | Locale browser Indonesia: "77.456" dibaca sebagai 77456 | Input harga gunakan `type="text"` + `parseLocaleNumber()` yang menangani `,` dan `.` sebagai desimal |
| Error CORS pada faucet | Frontend memanggil bulk.trade langsung | Routing melalui proxy `/api/faucet` |
| Encoding faucet salah | Nama field `amount` bukan `u`, pubkey 32-byte hilang di binary | Lihat bagian faucet di `signing.ts` |
| Session P&L menampilkan $0 | Dashboard membaca `margin.realizedPnl` (total akun historis) | Dashboard sekarang menggunakan `sessionPnl` dari fills BotRunner, reset setiap `start()` |
| Order terisi langsung (tidak resting) | Sisi crossing REACTIVE terbalik: UP→SELL, DOWN→BUY | Diperbaiki: UP→BUY (resting di bawah), DOWN→SELL (resting di atas) |
| Order SELL ditempatkan di bawah harga saat ini | Rumus `levelIdx` untuk DOWN adalah `prevLevel-i-1` | Diperbaiki: `currentLevel+i+1` → SELL selalu di atas harga saat ini |
| Order resting duplikat menguras margin | Tidak ada deduplikasi order live saat pantulan cepat | Ditambahkan pengecekan `hasOpenOrderAt()` sebelum setiap order |
| `totalTrades` menghitung order yang ditolak | `totalTrades++` ada di dalam loop penempatan order | Dipindah ke `handleFill()` — hanya menghitung fill yang dikonfirmasi |
| Error TypeScript `LogLine.text` di `logs.tsx` | `LogLine = { ts, msg }` bukan `{ ts, text }` | Diperbaiki menggunakan `.msg` di seluruh file |
| Nama/range bot tidak sesuai | DB menyimpan data lama, tidak ada fitur edit | Halaman edit bot di `/bots/:id/edit` (hentikan bot dulu) |

---

## Perbaikan Input Angka Berbasis Locale

Input harga harus menggunakan `type="text"` dengan `parseLocaleNumber()` (di `create.tsx` dan `edit.tsx`):
- Locale Indonesia menggunakan `.` sebagai pemisah ribuan, `,` sebagai desimal → `77.456` = 77456
- Parser kustom mendeteksi posisi pemisah terakhir untuk menentukan pemisah desimal
- Juga menampilkan komponen `GridRangePreview` dengan kalkulasi langkah live dan peringatan jika range > 100%

---

## Daftar Periksa Audit

Jalankan ini saat mengaudit sebelum sesi atau setelah perubahan besar:

```
[ ] pnpm run typecheck — nol error
[ ] pnpm --filter @workspace/db run push — skema tersinkron
[ ] API server merespons: curl http://localhost:8080/api/bots
[ ] Frontend termuat: cek port 24830
[ ] Penandatanganan: nonce dalam nanodetik (BigInt(Date.now()) * 1_000_000n)
[ ] Penandatanganan: semua order action memiliki iso=true (isolated margin) di binary dan JSON
[ ] Penandatanganan: reduceOnly benar sesuai mode (LONG+SELL=true, SHORT+BUY=true, NEUTRAL=false)
[ ] Input harga: gunakan type="text" bukan type="number"
[ ] Semua panggilan API eksternal melalui proxy /api, tidak pernah langsung dari browser
[ ] Private key tidak pernah dikirim ke backend (cek tab network)
[ ] Halaman edit bot: membutuhkan bot dalam status STOPPED terlebih dahulu
[ ] Session P&L di dashboard: membaca dari BotRunner.sessionPnl (berbasis fill), bukan DB atau margin exchange
[ ] Crossing REACTIVE: UP→BUY (resting di bawah current), DOWN→SELL (resting di atas current)
[ ] Pengisian ulang berbasis fill: BELUM diimplementasikan — lihat audit-botRunner.md untuk masalah P1
[ ] Field isBuy WS: verifikasi dengan fill live bahwa arahnya sesuai perspektif akun
```

---

## Celah P1 yang Diketahui (terbuka — lihat audit-botRunner.md untuk detail)

1. **REACTIVE profit nol**: BUY dan SELL mendarat di batas harga yang sama. Pengisian ulang berbasis fill belum diimplementasikan.
2. **UPFRONT tidak ada pengisian ulang**: Order yang terisi tidak digantikan. Grid habis seiring waktu.
3. **UPFRONT LONG/SHORT level salah**: Menempatkan order di semua level termasuk di atas/bawah harga saat ini (seharusnya melewati sisi agresif).

---

## Struktur Navigasi

```
/           (Dashboard)   — total session P&L, saldo akun, bot yang berjalan
/logs                     — log trading real-time per bot (kode warna, diurutkan berdasarkan waktu)
/bots                     — daftar bot (edit + hapus)
/bots/new                 — buat bot
/bots/:id                 — detail bot (viz grid, log, orders, start/stop, tombol edit)
/bots/:id/edit            — edit bot (khusus bot yang STOPPED)
/settings                 — manajemen kunci wallet, faucet, toggle staging/prod
```
