> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Market Data Streams

> Real-time price feeds, candles, trades, and order books

## Ticker Stream

Get 24-hour statistics updated every 200ms.

<CodeGroup>
  ```json Subscribe theme={null}
  {
    "method": "subscribe",
    "subscription": [{
      "type": "ticker",
      "symbol": "BTC-USD"
    }]
  }
  ```

  ```json Response theme={null}
  {
    "type": "subscriptionResponse",
    "topics": ["ticker.BTC-USD"]
  }
  ```

  ```json Update theme={null}
  {
    "type": "ticker",
    "data": {
      "ticker": {
        "symbol": "BTC-USD",
        "priceChange": 2777.5,
        "priceChangePercent": 2.77,
        "lastPrice": 102777.5,
        "highPrice": 103500.0,
        "lowPrice": 101000.0,
        "volume": 1234.56,
        "quoteVolume": 126543210.0,
        "markPrice": 102780.0,
        "oraclePrice": 102775.0,
        "openInterest": 5432.1,
        "fundingRate": 0.0001,
        "regime": 1,
        "regimeDt": 93,
        "regimeVol": 0.35,
        "regimeMv": 0.02,
        "fairBookPx": 102779.0,
        "fairVol": 0.28,
        "fairBias": 0.001,
        "timestamp": 1704067200000000000
      }
    },
    "topic": "ticker.BTC-USD"
  }
  ```
</CodeGroup>

**Update Frequency**: Every 200ms

**Ticker Fields**:

| Field                | Description                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `priceChange`        | Absolute price change over 24h                                                                                                                                                    |
| `priceChangePercent` | Percentage price change over 24h                                                                                                                                                  |
| `lastPrice`          | Last traded price                                                                                                                                                                 |
| `highPrice`          | 24h high                                                                                                                                                                          |
| `lowPrice`           | 24h low                                                                                                                                                                           |
| `volume`             | 24h base asset volume                                                                                                                                                             |
| `quoteVolume`        | 24h quote asset volume                                                                                                                                                            |
| `markPrice`          | Current fair/mark price                                                                                                                                                           |
| `oraclePrice`        | Oracle-reported price                                                                                                                                                             |
| `openInterest`       | Total open interest                                                                                                                                                               |
| `fundingRate`        | Current funding rate                                                                                                                                                              |
| `regime`             | Market regime indicator. Values from set {-12, -11, -10, 0, 1, 2, 10, 11, 12} representing direction (negative=bearish, 0=neutral, positive=bullish) crossed with volatility tier |
| `regimeDt`           | Regime duration in 10s intervals                                                                                                                                                  |
| `regimeVol`          | Regime-adjusted volatility                                                                                                                                                        |
| `regimeMv`           | Regime mean value                                                                                                                                                                 |
| `fairBookPx`         | Fair price derived from order book                                                                                                                                                |
| `fairVol`            | Fair volatility estimate                                                                                                                                                          |
| `fairBias`           | Fair price bias                                                                                                                                                                   |
| `timestamp`          | Timestamp (nanoseconds)                                                                                                                                                           |

***

## Candles Stream

Real-time candlestick data with historical backfill.

<CodeGroup>
  ```json Subscribe theme={null}
  {
    "method": "subscribe",
    "subscription": [{
      "type": "candle",
      "symbol": "BTC-USD",
      "interval": "1m"
    }]
  }
  ```

  ```json Response theme={null}
  {
    "type": "subscriptionResponse",
    "topics": ["candle.BTC-USD.1m"]
  }
  ```

  ```json Update theme={null}
  {
    "type": "candle",
    "data": {
      "candles": [
        {
          "t": 1699564800000,
          "T": 1699564860000,
          "o": 102000.0,
          "h": 102100.0,
          "l": 101900.0,
          "c": 101950.0,
          "v": 1.6,
          "n": 3
        }
      ]
    },
    "topic": "candle.BTC-USD.1m"
  }
  ```
</CodeGroup>

**Supported Intervals**: `10s`, `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`

**Initial Response**: Up to 5000 historical candles

**Updates**: Real-time (10s instant; larger intervals aggregated \~10–20s)

**Candle Fields**:

| Field | Description                    |
| ----- | ------------------------------ |
| `t`   | Open timestamp (milliseconds)  |
| `T`   | Close timestamp (milliseconds) |
| `o`   | Open price                     |
| `h`   | High price                     |
| `l`   | Low price                      |
| `c`   | Close price                    |
| `v`   | Volume                         |
| `n`   | Number of trades               |

***

## Trades Stream

Real-time trades feed

<CodeGroup>
  ```json Subscribe theme={null}
  {
    "method": "subscribe",
    "subscription": [{
      "type": "trades",
      "symbol": "BTC-USD"
    }]
  }
  ```

  ```json Response theme={null}
  {
    "type": "subscriptionResponse",
    "topics": ["trades.BTC-USD"]
  }
  ```

  ```json Update theme={null}
  {
    "type": "trades",
    "data": {
      "trades": [
        {
          "s": "BTC-USD",
          "px": 102500.0,
          "sz": 0.15,
          "time": 1699564800000,
          "side": true,
          "maker": "9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt",
          "taker": "5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux"
        }
      ]
    },
    "topic": "trades.BTC-USD"
  }
  ```
</CodeGroup>

**Initial Response**: None (stateless)

**Updates**: Real-time on every fill

**Trade Fields**:

| Field    | Description                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| `s`      | Symbol (market)                                                                                                  |
| `px`     | Execution price                                                                                                  |
| `sz`     | Size traded                                                                                                      |
| `time`   | Timestamp (milliseconds)                                                                                         |
| `side`   | `true` if taker bought, `false` if taker sold                                                                    |
| `maker`  | Maker public key (base58)                                                                                        |
| `taker`  | Taker public key (base58)                                                                                        |
| `reason` | Fill reason (optional; only present if not a normal trade, e.g. `"liquidation"`, `"adl"`, `"liquidation_sweep"`) |
| `liq`    | Liquidation flag (optional; only present if true)                                                                |

***

## L2 Snapshot Stream

Periodic full order book snapshots.

<CodeGroup>
  ```json Subscribe theme={null}
  {
    "method": "subscribe",
    "subscription": [{
      "type": "l2Snapshot",
      "symbol": "BTC-USD",
      "nlevels": 10,
      "aggregation": 0.5
    }]
  }
  ```

  ```json Response theme={null}
  {
    "type": "subscriptionResponse",
    "topics": ["l2snapshot.BTC-USD"]
  }
  ```

  ```json Update theme={null}
  {
    "type": "l2Snapshot",
    "data": {
      "book": {
        "updateType": "snapshot",
        "symbol": "BTC-USD",
        "levels": [
          [
            {"px": 102777.0, "sz": 1.5, "n": 3},
            {"px": 102776.5, "sz": 2.3, "n": 5},
            {"px": 102776.0, "sz": 0.8, "n": 2}
          ],
          [
            {"px": 102780.0, "sz": 2.0, "n": 4},
            {"px": 102780.5, "sz": 1.2, "n": 3},
            {"px": 102781.0, "sz": 1.8, "n": 2}
          ]
        ],
        "timestamp": 1699564800000
      }
    },
    "topic": "l2snapshot.BTC-USD"
  }
  ```
</CodeGroup>

**Parameters**:

* `nlevels` (optional): Number of price levels per side
* `aggregation` (optional): Price bucket size in quote currency

**Update Frequency**: Every 200ms

**Structure**: `levels[0]` = bids (descending), `levels[1]` = asks (ascending)

***

## L2 Delta Stream

Real-time incremental order book updates with initial snapshot.

<Note>
  L2 Delta sends an initial snapshot (latest cached book state) on subscription, then real-time delta updates for every price level change.
</Note>

<CodeGroup>
  ```json Subscribe theme={null}
  {
    "method": "subscribe",
    "subscription": [{
      "type": "l2Delta",
      "symbol": "BTC-USD"
    }]
  }
  ```

  ```json Response theme={null}
  {
    "type": "subscriptionResponse",
    "topics": ["l2delta.BTC-USD"]
  }
  ```

  ```json Delta (Bid Side) theme={null}
  {
    "type": "l2Delta",
    "data": {
      "book": {
        "updateType": "delta",
        "symbol": "BTC-USD",
        "levels": [
          [{"px": 102777.0, "sz": 2.0, "n": 0}],
          []
        ],
        "timestamp": 1699564800000
      }
    },
    "topic": "l2delta.BTC-USD"
  }
  ```

  ```json Delta (Ask Side) theme={null}
  {
    "type": "l2Delta",
    "data": {
      "book": {
        "updateType": "delta",
        "symbol": "BTC-USD",
        "levels": [
          [],
          [{"px": 102780.0, "sz": 1.5, "n": 0}]
        ],
        "timestamp": 1699564800000
      }
    },
    "topic": "l2delta.BTC-USD"
  }
  ```
</CodeGroup>

**Initial Response**: Latest cached book state (if available)

**Updates**: Real-time on every price level change

**Delta Format**:

* Each delta update contains changes to a single price level
* Only ONE side (bids or asks) will have levels per update (the other is empty `[]`)
* `levels[0]` = bids (highest to lowest)
* `levels[1]` = asks (lowest to highest)
* Each level: `{px, sz, n}` where `n` is always `0` for deltas
* `sz: 0` means remove the level

***

## Risk Metrics Stream

Subscribe to risk metrics for a symbol. Risk metrics include maintenance-margin surfaces (buy/sell grids over notional and leverage) and asset correlations.

<CodeGroup>
  ```json Subscribe theme={null}
  {
    "method": "subscribe",
    "subscription": [{
      "type": "risk",
      "symbol": "BTC-USD"
    }]
  }
  ```

  ```json Response theme={null}
  {
    "type": "subscriptionResponse",
    "topics": ["risk.BTC-USD"]
  }
  ```

  ```json Update theme={null}
  {
    "type": "risk",
    "data": {
      "risk": {
        "symbol": "BTC-USD",
        "timestamp": 1699564800000,
        "regime": 1,
        "leverage": [1.0, 2.0, 3.0, 4.0, 5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0],
        "notionals": [50000.0, 100000.0, 250000.0, 500000.0, 1000000.0, 5000000.0, 10000000.0],
        "buy": [
          [
            { "mmrO": 0.01, "mmrE": 0.008, "p": 0.9987 },
            { "mmrO": 0.015, "mmrE": 0.012, "p": 0.9987 }
          ],
          [
            { "mmrO": 0.012, "mmrE": 0.0095, "p": 0.9987 },
            { "mmrO": 0.018, "mmrE": 0.0145, "p": 0.9987 }
          ]
        ],
        "sell": [
          [
            { "mmrO": 0.01, "mmrE": 0.008, "p": 0.9987 },
            { "mmrO": 0.015, "mmrE": 0.012, "p": 0.9987 }
          ],
          [
            { "mmrO": 0.012, "mmrE": 0.0095, "p": 0.9987 },
            { "mmrO": 0.018, "mmrE": 0.0145, "p": 0.9987 }
          ]
        ],
        "corrs": [
          ["BTC:ETH", 0.7099833416646828],
          ["BTC:SOL", 0.7295520206661339],
          ["ETH:SOL", 0.7198669330795061]
        ]
      }
    },
    "topic": "risk.BTC-USD"
  }
  ```
</CodeGroup>

**Initial Response**: Latest cached risk metrics (if available)

**Updates**: Event-driven (only when asset risk changes)

**Risk Metrics Fields**:

| Field       | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| `symbol`    | Market symbol                                                        |
| `timestamp` | Timestamp in milliseconds                                            |
| `regime`    | Risk regime index (-12 to 12)                                        |
| `leverage`  | Array of leverage knot points (e.g. 1.0 … 50.0)                      |
| `notionals` | Array of notional knot points (e.g. 50000 … 10000000)                |
| `buy`       | 2D array of risk points `[notional_idx][leverage_idx]` for buy side  |
| `sell`      | 2D array of risk points `[notional_idx][leverage_idx]` for sell side |
| `corrs`     | Array of `[pair, correlation]` tuples (e.g. `["BTC:ETH", 0.71]`)     |

**Buy/sell point fields** (each cell in the grid):

| Field  | Description                              |
| ------ | ---------------------------------------- |
| `mmrO` | Start-of-regime maintenance margin ratio |
| `mmrE` | End-of-regime maintenance margin ratio   |
| `p`    | Probability of remaining in the regime   |

**Surface indexing**: To get the risk point for a given notional and leverage, find the notional bracket in `notionals`, the leverage bracket in `leverage`, then use `buy[notional_idx][leverage_idx]` or `sell[notional_idx][leverage_idx]`. Interpolate between surrounding grid points if needed.

***

## Frontend Context Stream

Aggregated market context for all symbols. Ideal for dashboard views.

<CodeGroup>
  ```json Subscribe theme={null}
  {
    "method": "subscribe",
    "subscription": [{
      "type": "frontendContext"
    }]
  }
  ```

  ```json Response theme={null}
  {
    "type": "subscriptionResponse",
    "topics": ["frontendContext"]
  }
  ```

  ```json Update theme={null}
  {
    "type": "frontendContext",
    "data": {
      "ctx": [
        {
          "symbol": "BTC-USD",
          "volume": 1234.56,
          "funding": 0.0001,
          "oi": 5432.1,
          "lastPrice": 102777.5,
          "priceChange": 2777.5,
          "priceChangePercent": 2.77
        },
        {
          "symbol": "ETH-USD",
          "volume": 5678.90,
          "funding": 0.00015,
          "oi": 12345.6,
          "lastPrice": 3500.0,
          "priceChange": 150.0,
          "priceChangePercent": 4.48
        }
      ]
    },
    "topic": "frontendContext"
  }
  ```
</CodeGroup>

**Initial Response**: Latest cached ticker data for all symbols

**Updates**: Every 2 seconds

**Context Fields**:

| Field                | Description                        |
| -------------------- | ---------------------------------- |
| `symbol`             | Market symbol                      |
| `volume`             | 24h trading volume (base currency) |
| `funding`            | Current funding rate               |
| `oi`                 | Open interest (base currency)      |
| `lastPrice`          | Last traded price                  |
| `priceChange`        | 24h price change (absolute)        |
| `priceChangePercent` | 24h price change (percentage)      |

***

## Multiple Subscriptions

Subscribe to multiple streams at once:

```json theme={null}
{
  "method": "subscribe",
  "subscription": [
    {"type": "ticker", "symbol": "BTC-USD"},
    {"type": "trades", "symbol": "BTC-USD"},
    {"type": "candle", "symbol": "BTC-USD", "interval": "1m"},
    {"type": "l2Snapshot", "symbol": "BTC-USD", "nlevels": 20},
    {"type": "l2Delta", "symbol": "BTC-USD"},
    {"type": "risk", "symbol": "BTC-USD"},
    {"type": "frontendContext"}
  ]
}
```

**Response**:

```json theme={null}
{
  "type": "subscriptionResponse",
  "topics": [
    "ticker.BTC-USD",
    "trades.BTC-USD",
    "candle.BTC-USD.1m",
    "l2snapshot.BTC-USD",
    "l2delta.BTC-USD",
    "risk.BTC-USD",
    "frontendContext"
  ]
}
```

***

## Example Implementation

<CodeGroup>
  ```javascript Node.js theme={null}
  const WebSocket = require('ws');

  const ws = new WebSocket('wss://exchange-ws1.bulk.trade');

  ws.on('open', () => {
    console.log('Connected to Bulk Exchange');
    
    // Subscribe to multiple streams
    ws.send(JSON.stringify({
      method: 'subscribe',
      subscription: [
        { type: 'ticker', symbol: 'BTC-USD' },
        { type: 'trades', symbol: 'BTC-USD' },
        { type: 'frontendContext' }
      ]
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    if (message.type === 'subscriptionResponse') {
      console.log('Subscribed to:', message.topics);
      return;
    }
    
    switch(message.type) {
      case 'ticker':
        console.log('Ticker:', message.data.ticker);
        break;
      case 'trades':
        console.log('Trade:', message.data.trades);
        break;
      case 'frontendContext':
        console.log('Context:', message.data.ctx);
        break;
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  ```

  ```python Python theme={null}
  import websocket
  import json

  def on_message(ws, message):
      data = json.loads(message)
      
      if data.get('type') == 'subscriptionResponse':
          print(f"Subscribed to: {data['topics']}")
          return
      
      msg_type = data.get('type')
      if msg_type == 'ticker':
          print(f"Ticker: {data['data']['ticker']}")
      elif msg_type == 'trades':
          print(f"Trade: {data['data']['trades']}")
      elif msg_type == 'frontendContext':
          print(f"Context: {data['data']['ctx']}")

  def on_open(ws):
      print('Connected to Bulk Exchange')
      
      # Subscribe to multiple streams
      ws.send(json.dumps({
          'method': 'subscribe',
          'subscription': [
              {'type': 'ticker', 'symbol': 'BTC-USD'},
              {'type': 'trades', 'symbol': 'BTC-USD'},
              {'type': 'frontendContext'}
          ]
      }))

  def on_error(ws, error):
      print(f'Error: {error}')

  ws = websocket.WebSocketApp(
      'wss://exchange-ws1.bulk.trade',
      on_message=on_message,
      on_open=on_open,
      on_error=on_error
  )

  ws.run_forever()
  ```
</CodeGroup>
