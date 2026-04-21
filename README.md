# YourFin - Premium Wealth Portfolio

YourFin is an institutional-grade personal finance and portfolio management application built with next-generation web technologies. It provides real-time market data across multiple asset classes (Crypto, Precious Metals, Stocks) wrapped in a fluid, high-end "Bento Grid" user interface.

## 🚀 Built With

### Core Framework
- **Next.js 16 (App Router)** - React framework for production
- **React 19** - Modern UI components
- **TypeScript** - Strict type-safety across the stack

### Styling & Animation
- **Tailwind CSS v4** - Utility-first styling
- **Framer Motion** - Spring-physics driven UI animations (Bento grids, micro-interactions)
- **GSAP** - Complex timeline animations and scroll effects
- **Spline 3D** - WebGL-based immersive 3D hero scenes
- **Phosphor Icons** - Premium icon suite

### Data & Architecture
- **NextAuth.js (v5)** - Secure authentication (JWT, Google OAuth, Credentials)
- **Prisma & PostgreSQL** - Type-safe database ORM and relational storage
- **Zustand & Zod** - Client-side state management and schema validation
- **TanStack Query** - Async state management and API caching
- **next-intl** - Seamless i18n support (English / Vietnamese)

## 🌟 Key Features

1. **Real-time Market Data Integration**: Fetches live crypto prices via Binance API and commodities/stocks via Yahoo Finance.
2. **Premium "Liquid Glass" UI**: Features minimalist dark-mode aesthetics, frosted glass navbars, and fluid hardware-accelerated animations.
3. **Immersive 3D Experiences**: Interactive 3D coverflow for asset selection and a WebGL Spline scene in the Hero section.
4. **Custom Auth Flow**: Beautiful, modal-driven sign-out sequences and secure session management.
5. **Localization**: Fully translated user interface supporting both Vietnamese and English.

## 📦 Getting Started

### Prerequisites
- Node.js (v20+)
- PostgreSQL Database

### Installation

1. Clone the repository
```bash
git clone https://github.com/Vinhnt06/wealth-portfolio.git
cd wealth-portfolio
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Setup Environment Variables
Create a `.env` file in the root directory and add the required keys (see `.env.example` if available).
```env
DATABASE_URL="postgresql://user:password@localhost:5432/yourfin"
AUTH_SECRET="your-nextauth-secret-key"
```

4. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

5. Start the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000` to view the application.

## 🤝 Project Structure
- `src/app/` - Next.js App Router structure (Pages, Dashboards, Layouts)
- `src/app/components/` - Reusable UI components (MarketSection, AboutSection, AssetCoverflow)
- `src/app/api/` - RESTful backend API routes handling external data fetching
- `prisma/` - Database schemas and migrations

## 📄 License
This project is proprietary and confidential.
