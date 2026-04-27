# 🚀 YourFin Local Development Guide

## Quick Start

### 1. Sử dụng Script Tự Động (Khuyến nghị)

```bash
# Khởi động cả Backend + Frontend
./dev.sh start

# Dừng tất cả
./dev.sh stop

# Khởi động lại
./dev.sh restart

# Kiểm tra trạng thái
./dev.sh status
```

### 2. Chạy Thủ Công

**Backend:**
```bash
cd backend
./mvnw clean package -DskipTests
java -jar target/api-0.0.1-SNAPSHOT.jar
```
→ Chạy trên `http://localhost:8080`

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
→ Chạy trên `http://localhost:3000`

## 🔗 URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080
- **Backend Status:** http://localhost:8080/
- **Health Check:** http://localhost:8080/api/health
- **Bitcoin Price:** http://localhost:8080/api/market/crypto?symbols=BTCUSDT
- **Gold Price:** http://localhost:8080/api/market/stocks?gold=true

## 🛠️ Troubleshooting

### Lỗi "Module not found: axios"
```bash
cd frontend
npm install axios
```

### Lỗi "Port already in use"
```bash
# Dừng backend
pkill -f "api-0.0.1-SNAPSHOT.jar"

# Dừng frontend
pkill -f "next dev"
```

### Lỗi Database Connection
Backend sẽ tự động kết nối Supabase production database. Không cần PostgreSQL local.

## 📦 Dependencies

**Backend:**
- Java 21
- Maven
- Spring Boot 3.3

**Frontend:**
- Node.js 18+
- Next.js 16
- React 19

## 🎯 Production Deployment

**Backend:** Render (Auto-deploy từ GitHub)
**Frontend:** Vercel (Auto-deploy từ GitHub)

Push code lên GitHub là tự động deploy!
