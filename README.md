# YourFin - Monorepo Structure

Enterprise-grade monorepo for YourFin wealth portfolio platform with decoupled backend and frontend.

## Project Structure

```
wealth-portfolio/
├── backend/                    # Java Spring Boot API
│   ├── src/
│   │   └── main/
│   │       ├── java/
│   │       └── resources/
│   ├── Dockerfile
│   ├── pom.xml
│   └── README.md
│
├── frontend/                   # Next.js Application (PLANNED)
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── shared/
│   │   └── lib/
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── docs/                       # Documentation
├── .agent/                     # AI agent configuration
└── README.md                   # This file
```

## Current Structure (Transitioning)

Currently, the frontend code is at the root level:
- `src/` - Frontend source code
- `public/` - Static assets
- `prisma/` - Database schema (to be removed)

**Next Step:** Move all frontend code into a dedicated `frontend/` folder to match the backend organization.

## Technology Stack

### Backend
- Java 21 LTS
- Spring Boot 3.3+
- PostgreSQL
- JWT Authentication
- Docker

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Framer Motion

## Development

### Backend
```bash
cd backend
./mvnw spring-boot:run
```

### Frontend
```bash
npm run dev
```

## Deployment

- **Backend:** Render (Docker)
- **Frontend:** Vercel
- **Database:** Render PostgreSQL

## Migration Status

- [x] Phase 1: Database Migration (JPA Entities)
- [x] Phase 2: Authentication (Spring Security + JWT)
- [ ] Phase 3: Service Layer
- [ ] Phase 4: External API Integration
- [ ] Phase 5: REST API Controllers
- [ ] Phase 6: Frontend Integration
- [ ] Phase 7: Deployment
