# YourFin Frontend

Next.js 16 frontend application for YourFin wealth portfolio management platform.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Framer Motion** (Animations)
- **GSAP** (Advanced animations)
- **Spline 3D** (WebGL scenes)
- **TanStack Query** (Server state)
- **Zustand** (Client state)
- **Axios** (HTTP client)

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                # Auth route group
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/           # Protected route group
│   │   ├── dashboard/
│   │   ├── profile/
│   │   └── layout.tsx
│   │
│   ├── about/                 # Public pages
│   ├── api/                   # API Routes (TO BE REMOVED)
│   ├── components/            # Shared components
│   ├── layout.tsx
│   ├── page.tsx               # Landing page
│   └── globals.css
│
├── features/                  # Feature-based modules
│   ├── auth/                  # Authentication
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   │
│   ├── dashboard/             # Dashboard
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── profile/               # User profile
│   │   ├── components/
│   │   └── services/
│   │
│   └── market/                # Market data
│       ├── components/
│       └── services/
│
├── shared/                    # Shared utilities
│   ├── components/            # Reusable UI components
│   ├── hooks/                 # Custom React hooks
│   ├── utils/                 # Helper functions
│   └── types/                 # TypeScript types
│
└── lib/                       # External integrations
    ├── api/                   # API client
    └── auth/                  # Auth utilities
```

## Current Status

### ✅ Completed
- Landing page with Spline 3D integration
- Market data section (real-time prices)
- About page
- Authentication pages (login/register)
- Dashboard layout
- Profile page

### 🔄 In Progress
- **Backend Migration:** Moving API logic to Java Spring Boot
- **Frontend Cleanup:** Removing `/api` routes
- **API Integration:** Connecting to new backend

### 📋 Planned Reorganization

#### Phase 1: Feature Extraction
- Move auth components to `features/auth/`
- Move dashboard components to `features/dashboard/`
- Move market components to `features/market/`
- Move profile components to `features/profile/`

#### Phase 2: Shared Components
- Extract reusable components to `shared/components/`
- Move custom hooks to `shared/hooks/`
- Organize utilities in `shared/utils/`
- Centralize types in `shared/types/`

#### Phase 3: API Integration
- Remove `src/app/api/` folder
- Create `lib/api/client.ts` for Axios
- Implement API services in feature folders
- Configure environment variables

## Environment Variables

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8080/api

# NextAuth (TO BE REMOVED)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...

# Database (TO BE REMOVED - Backend handles this)
DATABASE_URL=...
```

## Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Run Production Build
```bash
npm start
```

## Migration Notes

### Removing NextAuth.js
- Replace with JWT token storage (localStorage/cookies)
- Update login/register to call backend API
- Implement token refresh logic
- Remove `src/auth.ts`

### Removing API Routes
- Delete `src/app/api/` folder
- All API calls will go to Java backend
- Update all `fetch('/api/...')` to `apiClient.get('/...')`

### New API Client Pattern
```typescript
// lib/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

## Design System

### Colors
- Primary: Zinc (neutral)
- Accent: Emerald (success), Rose (error)
- Background: Dark mode (#09090b)

### Typography
- Headings: Be Vietnam Pro
- Body: Space Grotesk
- Mono: JetBrains Mono

### Components
- Bento Grid layouts
- Glassmorphism effects
- Smooth animations (Framer Motion)
- 3D elements (Spline)

## License

Proprietary - YourFin Platform
