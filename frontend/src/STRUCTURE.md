# Frontend Structure Organization

This document outlines the organized frontend structure for better maintainability and scalability.

## Directory Structure

```
src/
├── app/                        # Next.js App Router (Pages & Layouts)
│   ├── (auth)/                # Auth route group
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   ├── (dashboard)/           # Protected routes
│   │   ├── dashboard/
│   │   ├── profile/
│   │   └── layout.tsx
│   ├── about/
│   ├── components/            # Page-specific components
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── features/                  # Feature modules (domain logic)
│   ├── auth/
│   │   ├── components/       # Auth-specific components
│   │   ├── hooks/            # useAuth, useLogin, etc.
│   │   └── services/         # API calls for auth
│   ├── dashboard/
│   ├── profile/
│   └── market/
│
├── shared/                    # Shared across features
│   ├── components/           # Reusable UI components
│   ├── hooks/                # Custom hooks
│   ├── utils/                # Helper functions
│   └── types/                # TypeScript types
│
└── lib/                       # External integrations
    ├── api/                   # API client (Axios)
    └── auth/                  # Auth utilities
```

## Organization Principles

### 1. Feature-Based Structure
- Each feature has its own folder in `features/`
- Contains components, hooks, and services specific to that feature
- Promotes modularity and reusability

### 2. Shared Resources
- Common components go in `shared/components/`
- Reusable hooks in `shared/hooks/`
- Utility functions in `shared/utils/`
- Type definitions in `shared/types/`

### 3. App Router
- `app/` contains only routing and layouts
- Page-specific components stay in `app/components/`
- Route groups for auth and protected routes

## Current Status

✅ Created folder structure:
- `src/features/{auth,dashboard,profile,market}`
- `src/shared/{components,hooks,utils,types}`

📋 Next Steps:
- Move components to appropriate feature folders
- Extract shared components
- Create API client in `lib/api/`
- Remove `src/app/api/` after backend integration
