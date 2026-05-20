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

---

## 3. Audit Penandatanganan & Protokol

| Pemeriksaan | Status | Detail |
|-------------|--------|--------|
| Nonce dalam nanodetik | ✅ | `BigInt(Date.now()) * 1_000_000n` (`signing.ts` baris 182) |
| `iso: true` dalam binary | ✅ | `w.u8(action.iso ? 1 : 0)` — semua limit order meneruskan `iso: true` |
| `iso: true` dalam JSON | ✅ | `i: action.iso ?? false` dalam format wire |
| `reduceOnly` dalam binary | ✅ | `w.u8(action.reduceOnly ? 1 : 0)` |
| `reduceOnly` dalam JSON | ✅ | `r: action.reduceOnly ?? false` |
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

---

### 🔴 P1 — Mode REACTIVE: BUY dan SELL ditempatkan di batas harga yang sama (profit nol pada pantulan satu level)

**Lokasi**: `botRunner.ts` `runGridCheck()` baris 523–525

**Akar masalah**: Rumus UP (BUY) dan DOWN (SELL) menghasilkan `levelBasePrice(N)` yang SAMA untuk level N yang sama:
```
Crossing naik (12→13):  BUY  di levelIdx = prevLevel + i + 1 = 13  → harga = L + 13*S
Crossing turun (13→12): SELL di levelIdx = currentLevel + i + 1 = 13 → harga = L + 13*S
```
Pantulan bolak-balik antara level 12 dan 13 menghasilkan:
- BUY @ L+13*S terisi saat harga turun ke batas itu
- SELL @ L+13*S ditempatkan segera setelah → terisi saat harga naik kembali
- **Net = 0. Hanya biaya yang hilang.**

Hal ini berlaku juga untuk pergerakan multi-level: setiap BUY dan SELL untuk level N yang sama selalu berada di harga yang sama.

**Spesifikasi SKILL.md menyatakan**: "Saat fill: isi ulang — BUY terisi → tempatkan SELL satu langkah di atas; SELL terisi → tempatkan BUY satu langkah di bawah."
Pengisian ulang berbasis fill ini BELUM diimplementasikan. `handleFill()` hanya melacak session P&L; tidak menempatkan order pengisian ulang.

**Opsi perbaikan**:

**Opsi A (pengisian ulang berbasis fill — benar sesuai SKILL.md)**:
Di `handleFill()`, setelah mendeteksi fill:
- BUY terisi di harga P → tempatkan resting SELL di `snapToGridLevel(P + gridSpacing, ...)` (satu level di atas)
- SELL terisi di harga P → tempatkan resting BUY di `snapToGridLevel(P - gridSpacing, ...)` (satu level di bawah)
Ini menjamin spread = 1 spacing → profit = spacing × size − biaya per round trip. Penempatan berbasis crossing di `runGridCheck()` hanya menjadi seeding awal.

**Opsi B (koreksi offset crossing)**:
Untuk crossing turun, geser levelIdx ke atas sebesar 1:
```typescript
const levelIdx = levelsMoved < 0
  ? currentLevel + i + 2   // ← sebelumnya +1
  : prevLevel + i + 1;
```
Profit = 1 spacing per round trip. Lebih sederhana, tapi tidak menangani kasus di mana tidak ada crossing sebelum fill.

**Rekomendasi**: Opsi A (pengisian ulang berbasis fill) — sesuai spesifikasi SKILL.md, benar untuk mode UPFRONT maupun REACTIVE.

---

### 🔴 P1 — Mode UPFRONT: tidak ada pengisian ulang setelah fill

**Lokasi**: `botRunner.ts` — `handleFill()`, `placeAllOrdersUpfront()`

Saat mode UPFRONT berjalan:
- Semua N order ditempatkan langsung saat start
- Saat fill terjadi → tidak ada order baru yang ditempatkan
- Level yang terisi selamanya kosong; tidak akan pernah trading lagi
- Setelah cukup banyak fill, grid habis total dan bot diam dengan semua margin dalam posisi

**Perbaikan**: Di `handleFill()`, cek `config.orderMode === "UPFRONT"` dan terapkan pengisian ulang berbasis fill (sama seperti Opsi A di atas). Ini adalah perilaku standar semua grid bot.

---

### 🔴 P1 — Mode UPFRONT LONG/SHORT menempatkan order di level yang salah

**Lokasi**: `botRunner.ts` `placeAllOrdersUpfront()` baris 357–364

Untuk mode LONG: **semua `gridCount` level** mendapat order BUY, termasuk level DI ATAS harga saat ini. Order-order ini langsung crossing buku sebagai aggressive fill (bukan resting limit order). Exchange mengisinya di harga pasar, membuang spread pada saat masuk.

Untuk mode SHORT: masalah yang sama — SELL di bawah harga saat ini langsung terisi.

**Perilaku yang benar** (sesuai `gridEngine.ts`): LONG menempatkan BUY hanya di bawah harga saat ini; SHORT menempatkan SELL hanya di atas harga saat ini.

**Perbaikan**:
```typescript
if (this.config.mode === "LONG" && orderPrice >= currentPrice) { skipped++; continue; }
if (this.config.mode === "SHORT" && orderPrice <= currentPrice) { skipped++; continue; }
```

---

### 🟡 P2 — Map `recentOrders` tumbuh tanpa batas

**Lokasi**: `botRunner.ts` baris 89, `isDuplicateOrder()` baris 214–219

Map `recentOrders` mengakumulasi satu entri per pasangan level+sisi yang pernah dilihat. Tidak ada mekanisme pembersihan yang ada.

**Perbaikan**: Di `isDuplicateOrder()`, hapus entri yang lebih lama dari `DUP_GUARD_MS`:
```typescript
private isDuplicateOrder(levelIdx: number, side: "BUY" | "SELL"): boolean {
  const now = Date.now();
  for (const [k, t] of this.recentOrders) {
    if (now - t >= DUP_GUARD_MS) this.recentOrders.delete(k);
  }
  const key = `${levelIdx}:${side}`;
  const last = this.recentOrders.get(key);
  if (last !== undefined && now - last < DUP_GUARD_MS) return true;
  this.recentOrders.set(key, now);
  return false;
}
```

---

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

---

## 8. Ringkasan

| Tingkat | Jumlah | Keterangan |
|---------|--------|-----------|
| 🔴 P1 Kritis | 3 | REACTIVE profit nol, UPFRONT tidak ada pengisian ulang, UPFRONT level salah |
| 🟡 P2 Sedang | 3 | Kebocoran Map, ketidaksesuaian IDLE/STOPPED, ambiguitas isBuy |
| ✅ Diperbaiki | 7 | Sisi crossing, levelIdx, hasOpenOrderAt, totalTrades, sessionPnl, halaman logs, LogLine.msg |

**Langkah berikutnya yang direkomendasikan**: Implementasikan pengisian ulang berbasis fill di `handleFill()` — satu perubahan ini memperbaiki P1-REACTIVE dan P1-UPFRONT sekaligus, sesuai dengan spesifikasi SKILL.md.
