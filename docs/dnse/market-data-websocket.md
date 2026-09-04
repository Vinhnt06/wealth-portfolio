---
title: DNSE Market Data WebSocket API Specification
description: Technical reference and integration guide for DNSE Market Data WebSocket API
sidebar_position: 1
---

# DNSE Market Data WebSocket API Specification

Tài liệu hướng dẫn tích hợp và tham chiếu kỹ thuật cho DNSE Market Data WebSocket API, cung cấp dữ liệu thị trường chứng khoán Việt Nam theo thời gian thực (Real-time Market Data).

---

## 1. Thông tin Kết nối & Cơ chế Duy trì (Connection & Heartbeat)

### 1.1 Thông tin Kết nối (Endpoint & SDK)
- **Base WebSocket URL**: `wss://ws-openapi.dnse.com.vn`
- **Official SDK Repository**: [DNSE OpenAPI SDK (GitHub)](https://github.com/dnse-tech/openapi-sdk)
- **Định dạng Dữ liệu (Encoding)**:
  - `msgpack`: Tốc độ xử lý cao, tối ưu băng thông (Production recommended).
  - `json`: Dễ đọc, phục vụ phát triển và kiểm thử (Development).

### 1.2 Quy tắc Kết nối & Session Lifecycle
1. **Mã chứng khoán**: Tất cả mã phải viết dưới dạng **CHỮ IN HOA** (Ví dụ: `ACB`, `HPG`, `41I1G2000`).
2. **Thời lượng session**: Tối đa **8 giờ**. Sau 8 giờ, server sẽ tự động ngắt kết nối.
3. **Cơ chế PING / PONG (Heartbeat)**:
   - Server gửi **PING** message định kỳ mỗi **3 phút**.
   - Client **BẮT BUỘC** phản hồi **PONG** trong vòng **1 phút** kể từ khi nhận PING.
   - Nếu không nhận được PONG trong 1 phút, Server sẽ chủ động ngắt kết nối.
   - **Keepalive từ phía Client**: Client được phép chủ động gửi PONG định kỳ (ví dụ mỗi 2-3 phút) mà không cần đợi PING từ Server nhằm tránh việc mất kết nối do mobile network / NAT idle timeout.

#### Flowchart xử lý PING/PONG
```
Server                           Client
  | --- PING (mỗi 3 phút) --------> |
  | <--- PONG (trong vòng 1 phút) - | (✅ Kết nối duy trì)
  |                                 |
  | --- PING (không thấy PONG) ---> |
  | (quá 1 phút)                    |
  | === DISCONNECT ================ | (❌ Ngắt kết nối)
```

---

## 2. Danh mục Kênh Dữ liệu (Data Channels Summary)

| Kênh (Channel / Function) | Định dạng Sub Channel | Loại (Type) | Tần suất (Frequency) |
|---|---|---|---|
| **Security Definition** | `security_definition.{board_id}.{encoding}` | Batch (BOD) | Gửi 2 lần/ngày (~08:00 AM & ~08:00 PM) |
| **Trade** | `tick.{board_id}.{encoding}` | Real-time | Cập nhật ngay khi có khớp lệnh |
| **Trade Extra** | `tick_extra.{board_id}.{encoding}` | Real-time | Cập nhật khi khớp lệnh (kèm mua/bán chủ động, giá TB) |
| **Quotes** | `top_price.{board_id}.{encoding}` | Real-time | Cập nhật độ sâu sổ lệnh (Sàn HOSE: 3 mức, HNX/UPCOM: 10 mức) |
| **OHLC (Building)** | `ohlc.{resolution}.{encoding}` | Real-time | Cập nhật theo nến đang hình thành |
| **OHLC Closed** | `ohlc_closed.{resolution}.{encoding}` | Periodic | Cập nhật 1 lần khi nến đóng |
| **Expected Price** | `expected_price.{board_id}.{encoding}` | Real-time | Cập nhật giá dự khớp trong phiên ATO/ATC |
| **Market Index** | `market_index.{market_index}.{encoding}` | Periodic | Cập nhật mỗi 5s & tổng hợp cuối ngày |
| **Foreign Investor** | `foreign.{board_id}.{encoding}` | Real-time | Cập nhật khi có giao dịch NĐT nước ngoài |
| **Estimated VN30** | `estimated_market_index.{market_index}.{encoding}` | Real-time | Cập nhật VN30 dự tính theo thời gian thực |
| **Session** | `session.{product_group_id}.{board_id}.{encoding}` | Real-time | Cập nhật khi trạng thái phiên giao dịch thay đổi |

---

## 3. Tham số Tham chiếu Dùng chung (Common Input Enums)

### 3.1 Bảng giao dịch (`board_id`)
- `G1`: Lô chẵn (Khớp lệnh liên tục)
- `G3`: Bảng phiên sau giờ (PLO)
- `G4`: Lô lẻ
- `T1`: Thỏa thuận lô chẵn (09:00 - 14:45)
- `T3`: Thỏa thuận lô chẵn (14:45 - 15:00)
- `T4`: Thỏa thuận lô lẻ (09:00 - 14:45)
- `T6`: Thỏa thuận lô lẻ (14:45 - 15:00)

### 3.2 Chỉ số thị trường (`market_index`)
- `VNINDEX`: Chỉ số tổng hợp sàn HOSE
- `VN30`: Top 30 cổ phiếu sàn HOSE
- `HNX`: Chỉ số tổng hợp sàn HNX
- `HNX30`: Top 30 cổ phiếu sàn HNX
- `UPCOM`: Chỉ số thị trường UPCoM
- `VN100`, `VN50GROWTH`, `VNXALLSHARE`, `VNDIVIDEND`, `VNMITECH`

### 3.3 Nhóm sản phẩm (`tsc_prod_grp_id` / `tscProdGrpId`)
- `STO`: Cổ phiếu sàn HOSE
- `STX`: Cổ phiếu sàn HNX
- `UPX`: Cổ phiếu sàn UPCoM
- `FIO`: Hợp đồng tương lai chỉ số (Phái sinh)
- `FBX`: Hợp đồng tương lai trái phiếu
- `HCX`: Trái phiếu doanh nghiệp HNX

---

## 4. Chi tiết Schema Payload từng Kênh

### 4.1 Security Definition (`security_definition.{board_id}.{encoding}`)
Thông tin tham chiếu đầu ngày/cuối ngày (Trần, Sàn, Tham chiếu, Trạng thái giao dịch).

```json
{
  "marketId": "DVX",
  "boardId": "G1",
  "isin": "VN41I1G20009",
  "symbol": "41I1G2000",
  "productGrpId": "FIO",
  "securityGroupId": "FU",
  "basicPrice": 2066.6,
  "ceilingPrice": 2211.2,
  "floorPrice": 1922.0,
  "openInterestQuantity": 24473,
  "securityStatus": "NO_HALT",
  "symbolAdminStatusCode": "NRM",
  "symbolTradingMethodStatusCode": "NRM",
  "symbolTradingSanctionStatusCode": "NRM",
  "listingDate": 20260223,
  "finalTradeDate": 20260416,
  "time": {
    "Seconds": 1779757279,
    "Nanos": 101000000
  }
}
```

### 4.2 Trade & Trade Extra (`tick.{board_id}.{encoding}` & `tick_extra.{board_id}.{encoding}`)
Dữ liệu khớp lệnh thời gian thực. `tick_extra` có thêm thuộc tính `side` (BUY/SELL) và `avgPrice`.

#### Payload Trade Extra:
```json
{
  "marketId": "DVX",
  "boardId": "G1",
  "isin": "VN41I1G60005",
  "symbol": "41I1G6000",
  "matchPrice": 2022.5,
  "matchQtty": 1.0,
  "side": "SELL",
  "avgPrice": 2023.92,
  "totalVolumeTraded": 55913,
  "grossTradeAmount": 11316.34193,
  "highestPrice": 2028.0,
  "lowestPrice": 2018.3,
  "openPrice": 2018.6,
  "tradingSessionId": "40",
  "time": {
    "Seconds": 1779766822,
    "Nanos": 72000000
  }
}
```

### 4.3 Quotes - Sổ lệnh (`top_price.{board_id}.{encoding}`)
Độ sâu thị trường (Giá & Khối lượng Dư mua/Dư bán).

```json
{
  "marketId": "DVX",
  "boardId": "G1",
  "symbol": "41I1G6000",
  "bid": [
    { "price": 2023.4, "quantity": 9.0 },
    { "price": 2023.3, "quantity": 22.0 }
  ],
  "offer": [
    { "price": 2023.6, "quantity": 3.0 },
    { "price": 2023.7, "quantity": 62.0 }
  ],
  "totalOfferQtty": 8353.0,
  "totalBidQtty": 6447.0,
  "time": {
    "Seconds": 1779767143,
    "Nanos": 736000000
  }
}
```

### 4.4 OHLC Nến đang hình thành (`ohlc.{resolution}.{encoding}`)
Khung thời gian (`resolution`): `1`, `3`, `5`, `15`, `30`, `1H`, `1D`, `1W`.

```json
{
  "time": 1757992500,
  "open": 30.4,
  "high": 30.4,
  "low": 30.25,
  "close": 30.3,
  "volume": 1398200,
  "symbol": "HPG",
  "resolution": "15",
  "lastUpdated": 1757993014,
  "type": "STOCK"
}
```

### 4.5 Market Index (`market_index.{market_index}.{encoding}`)
Thông tin chỉ số thị trường (VNINDEX, VN30, HNX...).

```json
{
  "indexName": "VNINDEX",
  "changedRatio": 0.41,
  "changedValue": 6.84,
  "fluctuationSteadinessIssueCount": 67,
  "fluctuationDownIssueCount": 158,
  "fluctuationUpIssueCount": 144,
  "fluctuationLowerLimitIssueCount": null,
  "fluctuationUpperLimitIssueCount": 7,
  "valueIndexes": 1669.38,
  "grossTradeAmount": 18650.46734291,
  "totalVolumeTraded": 706563754,
  "marketId": "STO",
  "tradingSessionId": "40",
  "transactTime": {
    "Seconds": 1774940705,
    "Nanos": 0
  }
}
```

### 4.6 Foreign Investor (`foreign.{board_id}.{encoding}`)
Giao dịch khối ngoại (Mua, Bán, Room còn lại).

```json
{
  "symbol": "FPT",
  "boardId": "G1",
  "sellVolume": 1449400,
  "sellTradedAmount": 109774810000,
  "buyVolume": 608300,
  "buyTradedAmount": 46040960000,
  "totalSellVolume": 1449716,
  "totalBuyVolume": 608370,
  "foreignerOrderLimitQuantity": 341884580,
  "foreignerBuyPossibleQuantity": 351900000
}
```

---

## 5. Hướng dẫn Lập trình & Xử lý (Best Practices for Developers & AI)

1. **Heartbeat Manager**: Luôn tạo một timer riêng biệt để gửi `PONG` mỗi 2 phút nhằm duy trì kết nối WebSocket.
2. **Reconnection Strategy**: Sử dụng Exponential Backoff khi tự động kết nối lại nếu bị ngắt kết nối.
3. **Data Parsing**: Phân biệt giữa `msgpack` và `json` tùy thuộc vào môi trường (`encoding` parameter).
4. **Symbol Normalization**: Mọi symbol gửi lên phải qua hàm `.toUpperCase()`. Đối với phái sinh trong OHLC, sử dụng `symbolType` (ví dụ `VN30F1M`).
