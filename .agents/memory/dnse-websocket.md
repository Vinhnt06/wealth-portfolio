# DNSE Market Data WebSocket Memory Reference

- **Base URL**: `wss://ws-openapi.dnse.com.vn`
- **Full Spec File**: [docs/dnse/market-data-websocket.md](file:///Users/vinhh/Documents/YourFin/docs/dnse/market-data-websocket.md)
- **Key Rules for AI Implementations**:
  - Symbols must be uppercase (e.g. `ACB`, `HPG`, `41I1G2000`).
  - Max session lifetime: 8 hours.
  - Heartbeat: Server sends PING every 3 min, Client must reply PONG within 1 min. Client can send proactive PONG every <3 min.
  - Channels: `security_definition`, `tick`, `tick_extra`, `top_price`, `ohlc`, `ohlc_closed`, `expected_price`, `market_index`, `foreign`, `estimated_market_index`, `session`.
