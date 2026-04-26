# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
COPY src src

# Make wrapper executable
RUN chmod +x ./mvnw

# Package the application
RUN ./mvnw clean package -DskipTests

# Run stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/api-0.0.1-SNAPSHOT.jar app.jar

# Expose port (Render defaults to 10000 or custom)
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
