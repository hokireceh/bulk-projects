# Bulk Grid Trading Bot

Web app untuk automated grid trading di Bulk.trade perpetual futures exchange — mendukung tiga mode: Long, Short, dan Neutral.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/grid-bot run dev` — run the frontend (port 24830)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter (routing), framer-motion, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Signing: tweetnacl (Ed25519), bs58
- External: Bulk.trade staging API (`https://staging-api.bulk.trade/api/v1`, `wss://staging-ws.bulk.trade`)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/bots.ts` — DB schema: bots, bot_orders tables
- `artifacts/api-server/src/routes/bots.ts` — Bot CRUD + start/stop/orders/stats routes
- `artifacts/api-server/src/routes/markets.ts` — Proxy to bulk.trade exchangeInfo + ticker
- `artifacts/grid-bot/src/lib/gridEngine.ts` — Grid level calculation (LONG/SHORT/NEUTRAL)
- `artifacts/grid-bot/src/lib/signing.ts` — Ed25519 signing via bulk-keychain-wasm
- `artifacts/grid-bot/src/lib/botRunner.ts` — Bot lifecycle (place orders, WS fills)
- `artifacts/grid-bot/src/lib/keys.ts` — Derive pubkey from private key (tweetnacl)
- `docs/fetch-docs-bulk.js` — Script to download bulk.trade docs as markdown
- `docs/bulk-trade/` — All 26 bulk.trade API reference pages as .md files

## Architecture decisions

- Private key stored ONLY in localStorage (`bulk_private_key`) — never sent to backend
- Backend stores bot config/state/order logs; actual order placement runs client-side via WebSocket
- Markets data proxied through our API server to avoid CORS issues on frontend
- Grid levels calculated client-side: evenly spaced between lowerPrice and upperPrice
- Order size per grid = investment / gridCount / price

## Product

- **Dashboard**: Live stats — active bots, total investment, total P&L
- **My Bots**: Table of all bots with status badges and CRUD actions
- **Create Bot**: Form to configure symbol, mode (LONG/SHORT/NEUTRAL), price range, grid count, investment, leverage
- **Bot Detail**: Live grid visualization price ladder, orders table, start/stop controls
- **Settings**: Wallet/key management (localStorage), staging/prod toggle, faucet button

## User preferences

- Language: Indonesian (Bahasa Indonesia) in chat, code in English
- Docs fetched from bulk.trade as .md files in `docs/bulk-trade/`

## Gotchas

- Bulk.trade production endpoints are paused; use staging endpoints
- `nonce` for signed transactions must be in nanoseconds: `BigInt(Date.now()) * 1_000_000n`
- `i` flag (isolated margin) is required on all order actions — must be explicit
- After adding DB schema, run `pnpm run typecheck:libs` before typechecking leaf packages
- `tweetnacl` and `bs58` must be installed in `artifacts/grid-bot` for key derivation

## Pointers

- See `docs/bulk-trade/signing.md` for the full Ed25519 binary signing protocol
- See `docs/bulk-trade/placeOrder.md` for all order action types and their fields
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
