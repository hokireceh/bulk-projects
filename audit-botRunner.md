# Laporan Audit BotRunner
**Engine**: `artifacts/grid-bot/src/lib/botRunner.ts`
**Tanggal**: 20 Mei 2026
**tsc --noEmit**: ✅ BERSIH (nol error di semua paket)

---

## 1. Status Typecheck

```
pnpm run typecheck
  typecheck:libs  → tsc --build             ✅
  api-server      → tsc --noEmit            ✅
  grid-bot        → tsc --noEmit            ✅
  scripts         → tsc --noEmit            ✅
```

---

## 2. Perbaikan yang Diterapkan Sesi Ini

### FIX-01 — Sisi crossing REACTIVE terbalik (KRITIS)
**Sebelumnya**: crossing naik → SELL; crossing turun → BUY
**Masalah**: Order ditempatkan di sisi yang salah — langsung tereksekusi sebagai aggressive order, bukan resting limit.
**Perbaikan**: crossing naik → BUY (beli saat harga naik = resting di bawah current); crossing turun → SELL (jual saat harga turun = resting di atas current).
**File**: `botRunner.ts` baris 481

### FIX-02 — Rumus `levelIdx` untuk crossing turun (KRITIS)
**Sebelumnya**: `prevLevel - i - 1` → menghasilkan harga SELL di bawah harga saat ini (langsung crossing)
**Perbaikan**: `currentLevel + i + 1` → harga SELL selalu di atas harga saat ini (resting di buku order)
**File**: `botRunner.ts` baris 523–525

### FIX-03 — Pengecekan duplikat order via `hasOpenOrderAt()`
**Sebelumnya**: Tidak ada deduplikasi order live; pantulan harga cepat menempatkan order baru meski order lama masih resting dan memakan margin.
**Perbaikan**: `hasOpenOrderAt(price)` — memeriksa `openOrders[]` untuk order resting dalam jarak 2% dari grid spacing sebelum menempatkan order baru.
**File**: `botRunner.ts` baris 228–233

### FIX-04 — `totalTrades` terhitung saat placement bukan saat fill
**Sebelumnya**: `totalTrades++` ada di dalam loop placement (termasuk order yang gagal/ditolak)
**Perbaikan**: `totalTrades++` dipindah ke `handleFill()` — hanya menghitung fill yang dikonfirmasi exchange.
**File**: `botRunner.ts` baris 721

### FIX-05 — Session P&L: nilai exchange historis diganti kalkulasi berbasis fill
**Sebelumnya**: Dashboard menampilkan `margin.realizedPnl` — total akun sejak akun dibuat; tidak pernah reset per sesi bot.
**Perbaikan**: `sessionPnl = Σ(nilai SELL fill) − Σ(nilai BUY fill) − Σ(biaya)`. Reset saat `start()`, bertambah hanya di `handleFill()`.
**Field publik**: `sessionPnl`, `sessionFees`, `sessionSellValue`, `sessionBuyValue`
**File**: `botRunner.ts` baris 109–116, 262–265, 712–719

### FIX-06 — Halaman `/markets` diganti `/logs` (Trading Logs)
**Sebelumnya**: Halaman Markets tidak menampilkan data runtime yang berguna.
**Perbaikan**: Diganti dengan penampil log real-time per-bot, dengan kode warna berdasarkan tingkat keparahan (fill=hijau, error=merah, skip=kuning).
**File**: `artifacts/grid-bot/src/pages/logs.tsx`

### FIX-07 — `logs.tsx` menggunakan field yang salah (`text` vs `msg`)
**Sebelumnya**: `log.text` — field tidak ada pada tipe `LogLine`
**Perbaikan**: `log.msg` — benar sesuai `LogLine = { ts: number; msg: string }`
**Status tsc sebelum**: 10 error; setelah: 0 error

### FIX-08 — Fill-based replenishment di `handleFill()` ✅ RESOLVED (P1-REACTIVE + P1-UPFRONT)
**Sebelumnya**: `handleFill()` hanya melacak session P&L; tidak menempatkan order baru setelah fill.
**Perbaikan**: `scheduleReplenishment()` dipanggil dari `handleFill()` (baris 751) — BUY fill → SELL satu level di atas; SELL fill → BUY satu level di bawah. Berlaku untuk REACTIVE maupun UPFRONT.
**File**: `botRunner.ts` baris 748–823

### FIX-09 — UPFRONT LONG/SHORT skip level di atas/bawah harga saat ini ✅ RESOLVED (P1-UPFRONT-LEVEL)
**Sebelumnya**: Semua `gridCount` level mendapat order BUY (LONG) atau SELL (SHORT), termasuk yang di atas/bawah harga saat ini → aggressive fill.
**Perbaikan**: Guard eksplisit di `placeAllOrdersUpfront()`:
- LONG: `if (orderPrice >= currentPrice) { skipped++; continue; }` (baris 365)
- SHORT: `if (orderPrice <= currentPrice) { skipped++; continue; }` (baris 369)
**File**: `botRunner.ts` baris 363–373

### FIX-10 — Map `recentOrders` pruning ✅ RESOLVED (P2-recentOrders)
**Sebelumnya**: Tidak ada pembersihan; Map tumbuh tanpa batas.
**Perbaikan**: Loop prune di awal `isDuplicateOrder()` — hapus entri yang lebih lama dari `DUP_GUARD_MS` (baris 217–219).
**File**: `botRunner.ts` baris 214–225

### FIX-11 — POST /bots tidak menyimpan orderMode / stopLoss / takeProfit ✅ RESOLVED (BUG-CREATE-FIELDS)
**Sebelumnya**: INSERT ke `botsTable` tidak menyertakan `orderMode`, `stopLoss`, `takeProfit` — nilai frontend di-drop, DB menyimpan default.
**Perbaikan**: Tiga field ditambahkan ke INSERT (baris 52–54).
**File**: `artifacts/api-server/src/routes/bots.ts` baris 52–54

### FIX-12 — PATCH /bots/:id tidak mengupdate orderMode / stopLoss / takeProfit ✅ RESOLVED (BUG-UPDATE-FIELDS)
**Sebelumnya**: Blok `updateData` tidak menangani ketiga field — edit bot dengan SL/TP di-drop tanpa error.
**Perbaikan**: Tiga handler ditambahkan ke blok `updateData` (baris 98–100). `stopLoss ?? null` dan `takeProfit ?? null` memastikan clear eksplisit juga tersimpan.
**File**: `artifacts/api-server/src/routes/bots.ts` baris 98–100

### FIX-13 — GET /bots/:id/stats: filledOrders dan openOrders tanpa filter status ✅ RESOLVED (BUG-STATS-FILTER)
**Sebelumnya**: Kedua query hanya filter `botId` — `totalTrades` menghitung semua order termasuk OPEN/CANCELLED; `openOrders` sama persis dengan `totalOrders`.
**Perbaikan**: Filter `status` ditambahkan menggunakan `and()` dari drizzle-orm:
- `filledOrders`: `and(eq(botId), eq(status, "FILLED"))` (baris 247)
- `openOrders`: `and(eq(botId), eq(status, "OPEN"))` (baris 252)
**File**: `artifacts/api-server/src/routes/bots.ts` baris 241–252

### FIX-14 — NEUTRAL UPFRONT tidak skip level tepat di currentPrice ✅ RESOLVED (BUG-NEUTRAL-UPFRONT-BOUNDARY)
**Sebelumnya**: `placeAllOrdersUpfront()` NEUTRAL tidak memiliki guard untuk level dalam jarak 0.001 dari currentPrice — bisa BUY aggressive fill di edge case harga tepat di batas grid.
**Perbaikan**: Guard ditambahkan sebelum penentuan sisi:
```typescript
if (Math.abs(orderPrice - currentPrice) < 0.001) { skipped++; continue; }
```
Mirror: `gridEngine.ts` `calculateGridLevels()` baris 26.
**File**: `botRunner.ts` baris 377

### FIX-15 — Race condition positionUpdate saat replenishment LONG/SHORT ✅ RESOLVED (BUG-REPLENISH-RACE)
**Sebelumnya**: Delay 400ms antara fill dan `placeReplenishOrder()` — terlalu singkat untuk positionUpdate WS tiba; replenish SELL di-skip dengan "tidak ada posisi yang sesuai".
**Perbaikan**: Delay dinaikkan ke 1500ms (baris 777).
**File**: `botRunner.ts` baris 777

---

## 3. Audit Penandatanganan & Protokol

| Pemeriksaan | Status | Detail |
|-------------|--------|--------|
| Nonce dalam nanodetik | ✅ | `BigInt(Date.now()) * 1_000_000n` (`signing.ts` baris 182) |
| Binary limit layout lengkap | ✅ | `u32 disc` → `str symbol` → `u8 isBuy` → `u64 price` → `u64 size` → `u32 tif` → `u8 reduceOnly` → `u8 iso` |
| `iso: true` dalam binary | ✅ | `w.u8(action.iso ? 1 : 0)` — semua limit order meneruskan `iso: true` |
| `iso: true` dalam JSON | ✅ | `i: action.iso ?? false` dalam format wire |
| `reduceOnly` dalam binary | ✅ | `w.u8(action.reduceOnly ? 1 : 0)` |
| `reduceOnly` dalam JSON | ✅ | `r: action.reduceOnly ?? false` |
| JSON field names limit order | ✅ | `c`, `b`, `px` (string), `sz` (string), `tif`, `r`, `i` — sesuai docs |
| Binary cxa layout | ✅ | `u32 disc` → `u64 count` → `str[] symbols` |
| JSON cxa field | ✅ | `{ cxa: { c: symbols[] } }` — sesuai docs |
| Nonce u64 LE setelah actions | ✅ | `w.u64le(nonce)` setelah loop encodeAction (`signing.ts` baris 187) |
| Account 32-byte setelah nonce | ✅ | `w.raw(bs58.decode(accountBase58))` (baris 189) |
| Signer tidak ikut signed bytes | ✅ | Hanya di return object, tidak ditulis ke writer |
| Layout binary faucet | ✅ | 32 byte pubkey + tag Option (`u8`) — sesuai dokumentasi |
| Nama field JSON faucet | ✅ | `{ faucet: { u: pubkey } }` — sesuai dokumentasi (field `u`, bukan `user`) |
| Private key tidak pernah dikirim ke backend | ✅ | Hanya diteruskan ke `buildAndSign()` di browser; proxy route hanya meneruskan tx yang sudah ditandatangani |

---

## 4. Audit Pemetaan Field Stream Akun WS

### Event fill — `handleFill()`
| Field yang digunakan | Field dok. | Status |
|---------------------|-----------|--------|
| `data.price` | `price` | ✅ |
| `data.size` | `size` | ✅ |
| `data.fee` | `fee` | ✅ |
| `data.isBuy` | `isBuy` | ✅ ada |
| `data.symbol` | `symbol` | ✅ |

⚠️ **Ambiguitas arah `isBuy` (P2 — perlu verifikasi live)**: Dokumentasi mendefinisikan `isBuy = true jika taker membeli`. Untuk resting limit BUY kita (maker), counterparty adalah taker yang MENJUAL → `isBuy = false` dari perspektif taker. Belum jelas apakah exchange mengirimkan `isBuy` dari perspektif akun penerima (order BUY terisi → `true`) atau perspektif taker (taker jual → `false`). Jika perspektif taker, akumulasi `sessionBuyValue`/`sessionSellValue` TERBALIK — `sessionPnl` akan bernilai negatif dari yang seharusnya. **Wajib diverifikasi dengan satu fill live di staging.**

### Event orderUpdate — `handleOrderUpdate()`
| Field yang digunakan | Field dok. | Status |
|---------------------|-----------|--------|
| `data.sym` | `sym` | ✅ (dokumentasi mengkonfirmasi nama field compact) |
| `data.origSz` (bertanda) | `origSz` — bertanda, negatif=jual | ✅ |
| `data.sz` | `sz` — bertanda | ✅ |
| `data.px` | `px` | ✅ |
| `data.oid` | `oid` | ✅ |
| `data.fillSz` | `fillSz` | ✅ |
| `isBuy = origSz > 0` | diturunkan dari `origSz` bertanda | ✅ benar |

### openOrders AccountSnapshot — `parseOpenOrder()`
Snapshot menggunakan nama field panjang (`orderId`, `originalSize`, `symbol`); `parseOpenOrder` menangani kedua alias (`o.orderId ?? o.oid`, `o.originalSize ?? o.origSz`). ✅

---

## 5. Audit Logika Grid

### `gridEngine.ts`
| Fungsi | Status | Catatan |
|--------|--------|---------|
| `calculateGridLevels()` | ✅ | Filter LONG/SHORT/NEUTRAL benar; level tepat di harga saat ini dilewati |
| `allGridLevels()` | ✅ | gridCount+1 titik, dibulatkan 2 desimal |
| `snapToGridLevel()` | ✅ | Pemindaian linear, snap-terdekat benar |
| `sizePerGrid()` | ✅ | `(investment × leverage / gridCount) / price` — benar |

### `computeCurrentLevel()`
Mengembalikan indeks band berbasis floor, diklem ke `[0, gridCount-1]`. ✅

### `computeReduceOnly()`
- LONG + SELL → `true` (tutup long) ✅
- LONG + BUY → `false` (buka long) ✅
- SHORT + BUY → `true` (tutup short) ✅
- SHORT + SELL → `false` (buka short) ✅
- NEUTRAL → selalu `false` ✅

### `checkSlTp()`
- SL LONG/NEUTRAL: `price < stopLoss` ✅
- TP LONG/NEUTRAL: `price > takeProfit` ✅
- SL SHORT: `price > stopLoss` ✅
- TP SHORT: `price < takeProfit` ✅

---

## 6. Masalah yang Masih Terbuka

### 🟡 P2 — Ambiguitas `isBuy` pada event fill (verifikasi live)

Didokumentasikan di bagian §4 di atas. Jika exchange mengirimkan `isBuy` dari perspektif taker, session P&L akan terbalik arahnya. Lakukan satu fill nyata di staging dan catat nilai `isBuy` yang diterima untuk order BUY limit yang diketahui.

---

### 🟡 P2 — Status DB `IDLE` vs `IDLE`/`STOPPED` pada bots baru

Bot baru dibuat dengan `status: "IDLE"`. UI menampilkan badge untuk `RUNNING` dan `STOPPED` saja — bot dengan status `IDLE` tidak cocok dengan kondisi apapun. Kondisi edit (`status !== "RUNNING"`) tetap benar, tapi badge status di halaman list tidak akan tampil untuk bot yang baru dibuat. Pertimbangkan menyamakan default ke `"STOPPED"` atau menambahkan penanganan badge `IDLE`.

---

## 7. Invariant Arsitektur — LULUS

| Invariant | Status |
|-----------|--------|
| Private key tidak pernah dikirim ke backend | ✅ |
| Semua panggilan eksternal melalui proxy `/api` | ✅ |
| Nonce dalam nanodetik | ✅ |
| `iso: true` pada semua order action | ✅ |
| Input harga menggunakan `type="text"` + `parseLocaleNumber()` | ✅ |
| Dua bot di akun yang sama: routing fill benar via filter `symbol` | ✅ |
| `gridCheckInFlight` mencegah pengecekan re-entrant | ✅ |
| `lastLevel` disimpan ke localStorage (bertahan saat halaman di-refresh) | ✅ |
| Reconnect WS saat terputus (delay 3 detik) | ✅ |
| `stop()` membatalkan semua order terbuka untuk simbol tersebut | ✅ |
| Pengecekan SL/TP berjalan sebelum logika crossing | ✅ |
| Pre-check `reduceOnly` memverifikasi posisi yang cocok sebelum kirim | ✅ |
| Stats route filter status benar (FILLED/OPEN) | ✅ |
| POST /bots menyimpan orderMode + stopLoss + takeProfit | ✅ |
| PATCH /bots mengupdate orderMode + stopLoss + takeProfit | ✅ |

---

## 8. Ringkasan

| Tingkat | Jumlah | Keterangan |
|---------|--------|-----------|
| 🔴 P1 Kritis | 0 | Semua P1 telah diselesaikan |
| 🟡 P2 Sedang | 2 | Ambiguitas isBuy (verifikasi live), ketidaksesuaian IDLE/STOPPED |
| ✅ Diperbaiki total | 15 | FIX-01 s/d FIX-15 |

**P1 yang telah diselesaikan sesi ini**:
- P1-REACTIVE: fill-based replenishment (FIX-08)
- P1-UPFRONT-REPLENISH: sama, via `scheduleReplenishment()` tanpa filter orderMode (FIX-08)
- P1-UPFRONT-LEVEL: guard `orderPrice >= currentPrice` / `<= currentPrice` (FIX-09)
- BUG-CREATE-FIELDS: POST /bots insert orderMode/stopLoss/takeProfit (FIX-11)
- BUG-UPDATE-FIELDS: PATCH /bots/:id update orderMode/stopLoss/takeProfit (FIX-12)
- BUG-STATS-FILTER: filledOrders WHERE status=FILLED, openOrders WHERE status=OPEN (FIX-13)

**P2 yang telah diselesaikan sesi ini**:
- P2-recentOrders: Map pruning di `isDuplicateOrder()` (FIX-10)
- BUG-NEUTRAL-UPFRONT-BOUNDARY: skip level ±0.001 dari currentPrice (FIX-14)
- BUG-REPLENISH-RACE: delay replenishment 400ms → 1500ms (FIX-15)
