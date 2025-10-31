# Stage 1: Build JAR bằng Maven
FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run Spring Boot
FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY --from=build /app/target/webrtc-0.0.1-SNAPSHOT.jar app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
