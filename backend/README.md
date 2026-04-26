# YourFin Backend API

Spring Boot 3.3 backend service for YourFin wealth portfolio management platform.

## Tech Stack

- **Java 21 LTS**
- **Spring Boot 3.3+**
- **Spring Data JPA** (Hibernate)
- **Spring Security 6** (JWT Authentication)
- **PostgreSQL** (Database)
- **Maven** (Build tool)
- **Docker** (Containerization)

## Project Structure

```
backend/
├── src/main/java/com/yourfin/api/
│   ├── model/              # JPA Entities
│   │   ├── User.java
│   │   ├── Asset.java
│   │   ├── MarketPrice.java
│   │   ├── AssetType.java (enum)
│   │   └── AuthProvider.java (enum)
│   │
│   ├── repository/         # Spring Data JPA Repositories
│   │   ├── UserRepository.java
│   │   ├── AssetRepository.java
│   │   └── MarketPriceRepository.java
│   │
│   ├── service/            # Business Logic Layer
│   │   └── (Coming in Phase 2)
│   │
│   ├── controller/         # REST API Controllers
│   │   └── (Coming in Phase 2)
│   │
│   ├── dto/                # Data Transfer Objects
│   │   └── (Coming in Phase 2)
│   │
│   ├── security/           # JWT & Spring Security Config
│   │   └── (Coming in Phase 2)
│   │
│   ├── config/             # Application Configuration
│   │   └── (Coming in Phase 2)
│   │
│   └── exception/          # Custom Exceptions & Error Handling
│       └── (Coming in Phase 2)
│
├── src/main/resources/
│   └── application.properties  # Database & App Config
│
├── Dockerfile              # Docker build configuration
├── pom.xml                 # Maven dependencies
└── README.md               # This file
```

## Database Schema

### Users Table
- `id` (UUID, PK)
- `email` (unique)
- `password` (BCrypt hashed)
- `firstName`, `lastName`
- `phone`, `image`, `bio`, `location`
- `provider` (GOOGLE | CREDENTIALS)
- `dateOfBirth`, `age`, `occupation`
- `createdAt`, `updatedAt`

### Assets Table
- `id` (UUID, PK)
- `user_id` (FK → users)
- `type` (AssetType enum)
- `symbol` (e.g., BTCUSDT, AAPL, GC=F)
- `name`
- `quantity`
- `avgBuyPrice`
- `createdAt`, `updatedAt`

### Market Prices Table (Cache)
- `id` (UUID, PK)
- `symbol`
- `type` (AssetType enum)
- `price`, `change24h`, `changePercent`
- `volume24h`, `marketCap`
- `timestamp`

## Development

### Prerequisites
- Java 21 LTS
- PostgreSQL 14+
- Maven 3.9+ (or use included `./mvnw`)

### Build
```bash
./mvnw clean compile
```

### Run Locally
```bash
./mvnw spring-boot:run
```

### Run Tests
```bash
./mvnw test
```

## Deployment (Render)

### Build Command
```bash
./mvnw clean package -DskipTests
```

### Start Command
```bash
java -jar target/api-0.0.1-SNAPSHOT.jar
```

### Environment Variables
```
SPRING_DATASOURCE_URL=jdbc:postgresql://...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
JWT_SECRET=your-256-bit-secret
PORT=10000
```

## API Endpoints (Planned)

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login & get JWT
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Assets
- `GET /api/assets` - List user assets
- `POST /api/assets` - Add asset
- `PUT /api/assets/{id}` - Update asset
- `DELETE /api/assets/{id}` - Delete asset
- `GET /api/assets/portfolio` - Portfolio summary

### Market Data
- `GET /api/market/crypto?symbols=BTCUSDT,ETHUSDT`
- `GET /api/market/stocks?symbols=AAPL,GOOGL`
- `GET /api/market/commodities?type=gold,silver,oil`

### Profile
- `GET /api/profile` - Get profile
- `PUT /api/profile` - Update profile
- `DELETE /api/profile` - Delete account

## Migration Status

- [x] Phase 1: Database Migration (JPA Entities & Repositories)
- [ ] Phase 2: Authentication (Spring Security + JWT)
- [ ] Phase 3: Service Layer
- [ ] Phase 4: External API Integration
- [ ] Phase 5: REST API Controllers
- [ ] Phase 6: Frontend Integration
- [ ] Phase 7: Deployment

## License

Proprietary - YourFin Platform
