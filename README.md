<div align="center">

# 💰 YourFin

**Your Personal Wealth Management Platform**

Track, analyze, and grow your investment portfolio across crypto, stocks, gold, and forex markets in real-time.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

[Live Demo](#) • [Documentation](#) • [Report Bug](https://github.com/Vinhnt06/wealth-portfolio/issues)

</div>

---

## ✨ Why YourFin?

Managing investments across multiple asset classes shouldn't be complicated. YourFin brings everything together in one beautiful, intuitive platform.

### 🎯 Key Features

- **📊 Multi-Asset Portfolio Tracking** - Monitor crypto, stocks, gold, and forex in one unified dashboard
- **📈 Real-Time Market Data** - Live prices from Binance, Yahoo Finance, and Frankfurter APIs
- **💹 P&L Analytics** - Instant profit/loss calculations with visual insights
- **🔐 Bank-Grade Security** - JWT authentication with Spring Security
- **⚡ Lightning Fast** - Built on modern tech stack for optimal performance
- **📱 Responsive Design** - Beautiful UI that works on all devices

---

## 🚀 Tech Stack

### Backend (Enterprise-Grade)
- **Java 21 LTS** - Latest long-term support version
- **Spring Boot 3.3** - Production-ready framework
- **PostgreSQL** - Reliable relational database
- **JWT Authentication** - Secure token-based auth
- **Docker** - Containerized deployment

### Frontend (Modern & Fast)
- **Next.js 16** - React framework with App Router
- **React 19** - Latest React features
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling
- **Framer Motion** - Smooth animations

### Infrastructure
- **Supabase** - PostgreSQL database hosting
- **Render** - Backend deployment
- **Vercel** - Frontend deployment

---

## 📸 Screenshots

<div align="center">

### Dashboard Overview
![Dashboard](docs/screenshots/dashboard.png)

### Portfolio Analytics
![Analytics](docs/screenshots/analytics.png)

### Asset Management
![Assets](docs/screenshots/assets.png)

</div>

---

## 🎯 Quick Start

### Prerequisites

- Java 21+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend
./mvnw spring-boot:run
```

Backend runs on `http://localhost:8081`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:8080`

### Environment Variables

**Backend** (`backend/.env`):
```env
SPRING_DATASOURCE_URL=your_database_url
SPRING_DATASOURCE_USERNAME=your_username
SPRING_DATASOURCE_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION_MS=86400000
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8081/api
```

---

## 📦 Project Structure

```
wealth-portfolio/
├── backend/                 # Spring Boot API
│   ├── src/
│   │   └── main/
│   │       ├── java/       # Java source code
│   │       └── resources/  # Configuration files
│   ├── Dockerfile          # Docker configuration
│   └── pom.xml            # Maven dependencies
│
├── frontend/               # Next.js Application
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities & API clients
│   └── package.json       # NPM dependencies
│
└── docs/                  # Documentation
```

---

## 🔥 Features in Detail

### 1. Multi-Asset Portfolio Management
Track all your investments in one place:
- **Crypto**: Bitcoin, Ethereum, and 100+ cryptocurrencies
- **Stocks**: US, Asian, and European markets
- **Commodities**: Gold, Silver, Oil
- **Forex**: Major currency pairs

### 2. Real-Time Market Data
Powered by industry-leading APIs:
- **Binance API** - Cryptocurrency prices
- **Yahoo Finance** - Stock and commodity data
- **Frankfurter** - Foreign exchange rates

### 3. Advanced Analytics
- Portfolio performance tracking
- Profit/Loss calculations
- Asset allocation charts
- Historical performance graphs

### 4. Secure Authentication
- JWT-based authentication
- Password encryption with BCrypt
- Secure session management
- Role-based access control

---

## 🛣️ Roadmap

- [x] ✅ Core backend infrastructure
- [x] ✅ Authentication system
- [x] ✅ Real-time market data integration
- [x] ✅ Portfolio management
- [ ] 🚧 Advanced analytics dashboard
- [ ] 🚧 Mobile app (React Native)
- [ ] 📋 Price alerts & notifications
- [ ] 📋 Social trading features
- [ ] 📋 Tax reporting tools

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Vinh Nguyen**

- GitHub: [@Vinhnt06](https://github.com/Vinhnt06)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/yourprofile)

---

## 🙏 Acknowledgments

- [Spring Boot](https://spring.io/projects/spring-boot) - Backend framework
- [Next.js](https://nextjs.org/) - Frontend framework
- [Binance API](https://binance-docs.github.io/apidocs/) - Crypto market data
- [Yahoo Finance](https://finance.yahoo.com/) - Stock market data
- [Frankfurter](https://www.frankfurter.app/) - Forex data

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

Made with ❤️ by Vinh Nguyen

</div>
