> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Connection Management

> Subscriptions, reconnection, and best practices

# Connection Management

Best practices for maintaining reliable WebSocket connections.

***

## Optional Handshake Headers

Sockets that will be used to submit signed transactions via the [`post`](/api-reference/ws-trading) method can opt into an alternative signature verifier on the WebSocket upgrade:

| Header            | Allowed values                  | Purpose                                                                           |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `x-bulk-sig-mode` | `raw` \| `offchain` \| `base58` | Hint for the verifier attempt-order on every `post` action sent over this socket. |

Semantics:

* Missing header: server uses the default raw canonical-binary verification path.
* Invalid value: ignored safely (falls back to default raw verification).
* Valid value: used **only as an attempt-order hint**. Signature validity still decides accept/reject.
* The header is never trusted for authentication by itself.
* Sockets posting transactions signed with the [v0 Solana offchain envelope](/api-reference/signing#offchain-signing-mode) should set `x-bulk-sig-mode: offchain`.

The header has no effect on subscription-only sockets.

***

## Subscription Management

### Subscribe

Subscribe to one or multiple streams:

```json theme={null}
{
  "method": "subscribe",
  "subscription": [
    {"type": "ticker", "symbol": "BTC-USD"},
    {"type": "trades", "symbol": "ETH-USD"},
    {"type": "account", "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"}
  ]
}
```

**Response**:

```json theme={null}
{
  "type": "subscriptionResponse",
  "topics": [
    "ticker.BTC-USD",
    "trades.ETH-USD",
    "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  ]
}
```

Save the topic strings for unsubscription.

### Unsubscribe

Unsubscribe using the topic string:

```json theme={null}
{
  "method": "unsubscribe",
  "topic": "ticker.BTC-USD"
}
```

**Response**:

```json theme={null}
{
  "type": "unsubscribeResponse",
  "topic": "ticker.BTC-USD"
}
```

***

## Reconnection Strategy

WebSocket connections can drop due to network issues. Always implement reconnection logic.

<CodeGroup>
  ```javascript Node.js with Exponential Backoff theme={null}
  class BulkWebSocket {
    constructor(url) {
      this.url = url;
      this.ws = null;
      this.reconnectDelay = 1000;
      this.maxReconnectDelay = 30000;
      this.subscriptions = [];
      this.topics = [];
    }
    
    connect() {
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        console.log('Connected');
        this.reconnectDelay = 1000; // Reset delay
        this.resubscribe();
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data);
        this.handleMessage(message);
      });
      
      this.ws.on('close', () => {
        console.log('Disconnected. Reconnecting...');
        this.reconnect();
      });
      
      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    }
    
    reconnect() {
      setTimeout(() => {
        console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
        this.connect();
        
        // Exponential backoff
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
      }, this.reconnectDelay);
    }
    
    subscribe(subscription) {
      this.subscriptions.push(subscription);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          method: 'subscribe',
          subscription: [subscription]
        }));
      }
    }
    
    resubscribe() {
      if (this.subscriptions.length > 0) {
        this.ws.send(JSON.stringify({
          method: 'subscribe',
          subscription: this.subscriptions
        }));
      }
    }
    
    handleMessage(message) {
      if (message.type === 'subscriptionResponse') {
        this.topics = message.topics;
        console.log('Subscribed to:', this.topics);
        return;
      }
      
      // Handle data messages
      console.log('Received:', message);
    }
  }

  // Usage
  const ws = new BulkWebSocket('wss://exchange-ws1.bulk.trade');
  ws.connect();
  ws.subscribe({ type: 'ticker', symbol: 'BTC-USD' });
  ```

  ```python Python with Reconnection theme={null}
  import websocket
  import json
  import time
  import threading

  class BulkWebSocket:
      def __init__(self, url):
          self.url = url
          self.ws = None
          self.reconnect_delay = 1
          self.max_reconnect_delay = 30
          self.subscriptions = []
          self.topics = []
          self.running = True
      
      def connect(self):
          def on_open(ws):
              print('Connected')
              self.reconnect_delay = 1  # Reset delay
              self.resubscribe()
          
          def on_message(ws, message):
              data = json.loads(message)
              self.handle_message(data)
          
          def on_close(ws, close_status_code, close_msg):
              if self.running:
                  print('Disconnected. Reconnecting...')
                  self.reconnect()
          
          def on_error(ws, error):
              print(f'Error: {error}')
          
          self.ws = websocket.WebSocketApp(
              self.url,
              on_open=on_open,
              on_message=on_message,
              on_close=on_close,
              on_error=on_error
          )
          
          # Run in thread
          thread = threading.Thread(target=self.ws.run_forever)
          thread.daemon = True
          thread.start()
      
      def reconnect(self):
          time.sleep(self.reconnect_delay)
          print(f'Reconnecting...')
          self.connect()
          
          # Exponential backoff
          self.reconnect_delay = min(
              self.reconnect_delay * 2,
              self.max_reconnect_delay
          )
      
      def subscribe(self, subscription):
          self.subscriptions.append(subscription)
          
          if self.ws:
              self.ws.send(json.dumps({
                  'method': 'subscribe',
                  'subscription': [subscription]
              }))
      
      def resubscribe(self):
          if self.subscriptions:
              self.ws.send(json.dumps({
                  'method': 'subscribe',
                  'subscription': self.subscriptions
              }))
      
      def handle_message(self, message):
          if message.get('type') == 'subscriptionResponse':
              self.topics = message['topics']
              print(f'Subscribed to: {self.topics}')
              return
          
          print(f'Received: {message}')
      
      def close(self):
          self.running = False
          if self.ws:
              self.ws.close()

  # Usage
  ws = BulkWebSocket('wss://exchange-ws1.bulk.trade')
  ws.connect()
  ws.subscribe({'type': 'ticker', 'symbol': 'BTC-USD'})
  ```
</CodeGroup>

***

## Ping-Pong Keepalive (Required)

The server uses an explicit WebSocket ping/pong liveness check. You **must** respond to server pings with pongs or the connection will be closed.

| Behavior             | Detail                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Ping interval**    | Server sends a WebSocket `ping` frame every **30 seconds**                                    |
| **Pong requirement** | Client must reply with a WebSocket `pong` frame                                               |
| **Timeout**          | If a pong is still missing **10 seconds** after a ping, the server disconnects the connection |
| **Frame type**       | Ping/pong are **transport-level** WebSocket frames, not application (JSON) messages           |

**Client recommendations:**

* Respond immediately to ping frames with pong. Many WebSocket client libraries (e.g. Node.js `ws`) do this automatically; if yours does not, handle the `ping` event and send a pong.
* Do not treat ping/pong as application messages -they are separate from `subscribe`, `post`, and data messages.
* If you are disconnected due to a missed pong, reconnect and [resubscribe](#resubscribe) to your topics.

<CodeGroup>
  ```javascript Node.js (ws) theme={null}
  const WebSocket = require('ws');

  const ws = new WebSocket('wss://exchange-ws1.bulk.trade');

  // Node.js 'ws' automatically replies to ping with pong by default.
  // To handle explicitly (e.g. for logging or custom behavior):
  ws.on('ping', () => {
    ws.pong(); // optional: library often does this automatically
  });

  ws.on('pong', () => {
    // Server may send pong in response to client ping; keepalive is server-initiated
  });
  ```

  ```javascript Browser theme={null}
  // Browser WebSocket API automatically responds to server ping with pong.
  // No extra code needed for keepalive; ensure you don't ignore or close on ping.
  const ws = new WebSocket('wss://exchange-ws1.bulk.trade');
  ```
</CodeGroup>

***

## Rate Limits

<Warning>
  **Connection Limits**

  * Maximum **100 subscriptions** per connection
  * Maximum **1000 messages per second**
  * Exceeding limits will result in disconnection

  If you need more subscriptions, open multiple connections.
</Warning>

***

## Best Practices

<AccordionGroup>
  <Accordion title="Always implement reconnection logic">
    Network issues are inevitable. Your application should automatically reconnect with exponential backoff.
  </Accordion>

  <Accordion title="Store subscriptions for resubscription">
    After reconnecting, you must resubscribe to all channels. Store your subscription list.
  </Accordion>

  <Accordion title="Handle message ordering">
    Messages may arrive out of order during high load. Use timestamps and sequence numbers.
  </Accordion>

  <Accordion title="Respond to server ping with pong">
    The server sends a ping every 30 seconds. If the client does not reply with a pong within 10 seconds, the server disconnects. Use a client that responds to ping (or handle it explicitly) and always implement reconnection.
  </Accordion>

  <Accordion title="Implement timeouts">
    If no application message is received for a long period, consider the connection stale and reconnect. Note: the server will already disconnect if pong is not sent within 10 seconds of a ping.
  </Accordion>

  <Accordion title="Use compression">
    Enable per-message deflate for bandwidth savings on high-frequency streams.
  </Accordion>

  <Accordion title="Separate connections for trading">
    Use one connection for market data and another for trading to avoid mixing concerns.
  </Accordion>
</AccordionGroup>

***

## Connection States

Monitor connection state to handle different scenarios:

| State        | Description         | Action                    |
| ------------ | ------------------- | ------------------------- |
| `CONNECTING` | Initial connection  | Wait for open event       |
| `OPEN`       | Connected and ready | Can send/receive messages |
| `CLOSING`    | Connection closing  | Stop sending messages     |
| `CLOSED`     | Connection closed   | Reconnect if needed       |

***

## Error Codes

Common WebSocket close codes:

| Code | Reason           | Action                |
| ---- | ---------------- | --------------------- |
| 1000 | Normal closure   | No action needed      |
| 1001 | Going away       | Reconnect             |
| 1002 | Protocol error   | Check message format  |
| 1003 | Unsupported data | Check message content |
| 1006 | Abnormal closure | Reconnect             |
| 1008 | Policy violation | Check rate limits     |
| 1011 | Server error     | Retry with backoff    |

***

## Monitoring Connection Health

Implement health checks to detect stale connections:

```javascript theme={null}
class ConnectionMonitor {
  constructor(ws, timeout = 60000) {
    this.ws = ws;
    this.timeout = timeout;
    this.lastMessage = Date.now();
    this.checkInterval = null;
  }
  
  start() {
    // Update timestamp on every message
    this.ws.on('message', () => {
      this.lastMessage = Date.now();
    });
    
    // Check health every 10 seconds
    this.checkInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessage;
      
      if (timeSinceLastMessage > this.timeout) {
        console.warn('Connection stale, reconnecting...');
        this.ws.close();
      }
    }, 10000);
  }
  
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Usage
const monitor = new ConnectionMonitor(ws);
monitor.start();
```

***

## Multiple Connections

For high-throughput applications, consider using multiple connections:

```javascript theme={null}
// Connection 1: Market data
const marketDataWs = new WebSocket('wss://exchange-ws1.bulk.trade');
marketDataWs.on('open', () => {
  marketDataWs.send(JSON.stringify({
    method: 'subscribe',
    subscription: [
      { type: 'ticker', symbol: 'BTC-USD' },
      { type: 'trades', symbol: 'BTC-USD' }
    ]
  }));
});

// Connection 2: Account updates
const accountWs = new WebSocket('wss://exchange-ws1.bulk.trade');
accountWs.on('open', () => {
  accountWs.send(JSON.stringify({
    method: 'subscribe',
    subscription: [
      { type: 'account', user: PUBLIC_KEY }
    ]
  }));
});

// Connection 3: Trading
const tradingWs = new WebSocket('wss://exchange-ws1.bulk.trade');
// Use this for order placement/cancellation
```

***

## Testing Connection

Test your WebSocket connection with a simple script:

```javascript theme={null}
const WebSocket = require('ws');

const ws = new WebSocket('wss://exchange-ws1.bulk.trade');

ws.on('open', () => {
  console.log('✓ Connected successfully');
  
  // Test subscription
  ws.send(JSON.stringify({
    method: 'subscribe',
    subscription: [{ type: 'ticker', symbol: 'BTC-USD' }]
  }));
  
  setTimeout(() => {
    console.log('Test complete');
    ws.close();
  }, 5000);
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'subscriptionResponse') {
    console.log('✓ Subscribed to:', message.topics);
  } else {
    console.log('✓ Received update:', message.type);
  }
});

ws.on('error', (error) => {
  console.error('✗ Error:', error);
});

ws.on('close', () => {
  console.log('✓ Connection closed');
});
```
