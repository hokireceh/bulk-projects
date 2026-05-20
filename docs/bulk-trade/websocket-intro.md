> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# WebSocket Overview

> Real-time market data and trading via WebSocket

## Connection

<CodeGroup>
  ```javascript Production theme={null}
  const ws = new WebSocket('wss://exchange-ws1.bulk.trade');
  ```
</CodeGroup>

**Exchange WebSocket URL**: `wss://exchange-ws1.bulk.trade`

### Ping-Pong Keepalive

The server sends a WebSocket **ping** frame every **30 seconds**. The client **must** reply with a **pong** frame; if no pong is received within **10 seconds**, the server disconnects the connection. Ping/pong are transport-level frames, not application (JSON) messages. Many client libraries respond to ping automatically. See [Connection Management](/api-reference/ws-connection#ping-pong-keepalive-required) for details.

***

## Stream Types

<CardGroup cols={2}>
  <Card title="Market Data" icon="chart-line" href="/api-reference/ws-market-data">
    Real-time price feeds, order books, and trades
  </Card>

  <Card title="Account Updates" icon="user" href="/api-reference/ws-account">
    Live position and order updates
  </Card>

  <Card title="Multisig Stream" icon="users" href="/api-reference/ws-multisig">
    Proposal snapshots for multisig smart accounts
  </Card>

  <Card title="Trading" icon="bolt" href="/api-reference/ws-trading">
    Submit orders via WebSocket for lowest latency
  </Card>

  <Card title="Connection Management" icon="plug" href="/api-reference/ws-connection">
    Subscriptions, reconnection, and best practices
  </Card>
</CardGroup>

***

## Quick Example

<CodeGroup>
  ```javascript Node.js theme={null}
  const WebSocket = require('ws');

  const ws = new WebSocket('wss://exchange-ws1.bulk.trade');

  ws.on('open', () => {
    // Subscribe to ticker
    ws.send(JSON.stringify({
      method: 'subscribe',
      subscription: [{
        type: 'ticker',
        symbol: 'BTC-USD'
      }]
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    // Handle subscription confirmation
    if (message.type === 'subscriptionResponse') {
      console.log('Subscribed to:', message.topics);
      return;
    }
    
    // Handle ticker updates
    if (message.type === 'ticker') {
      console.log('Ticker:', message.data.ticker);
    }
  });
  ```

  ```python Python theme={null}
  import websocket
  import json

  def on_message(ws, message):
      data = json.loads(message)
      
      # Handle subscription confirmation
      if data.get('type') == 'subscriptionResponse':
          print(f"Subscribed to: {data['topics']}")
          return
      
      # Handle ticker updates
      if data.get('type') == 'ticker':
          print(f"Ticker: {data['data']['ticker']}")

  def on_open(ws):
      ws.send(json.dumps({
          'method': 'subscribe',
          'subscription': [{
              'type': 'ticker',
              'symbol': 'BTC-USD'
          }]
      }))

  ws = websocket.WebSocketApp(
      'wss://exchange-ws1.bulk.trade',
      on_message=on_message,
      on_open=on_open
  )

  ws.run_forever()
  ```
</CodeGroup>

***

## Subscription Response Format

All subscriptions return a confirmation with topic strings:

```json theme={null}
// Request
{
  "method": "subscribe",
  "subscription": [
    {"type": "ticker", "symbol": "BTC-USD"},
    {"type": "trades", "symbol": "BTC-USD"}
  ]
}

// Response
{
  "type": "subscriptionResponse",
  "topics": [
    "ticker.BTC-USD",
    "trades.BTC-USD"
  ]
}
```

Use the topic strings to unsubscribe later.

***

## Unsubscribe

```json theme={null}
{
  "method": "unsubscribe",
  "topic": "ticker.BTC-USD"
}
```

***

## Rate Limits

<Warning>
  * Maximum 100 subscriptions per connection
  * Maximum 1000 messages per second
  * Violating limits will result in disconnection
</Warning>

***

## Next Steps

<CardGroup cols={2}>
  <Card title="Market Data Streams" icon="chart-line" href="/api-reference/ws-market-data">
    Ticker, Candles, Trades, Order Book
  </Card>

  <Card title="Account Stream" icon="user" href="/api-reference/ws-account">
    Real-time positions and orders
  </Card>
</CardGroup>
