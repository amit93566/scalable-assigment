# ====== Build stage ======
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# ====== Run stage ======
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

COPY --from=build /app/target/paymentsservice-*.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "app.jar"]
