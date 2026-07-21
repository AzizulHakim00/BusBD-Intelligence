FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM maven:3.9.11-eclipse-temurin-21 AS backend-build
WORKDIR /workspace
COPY backend/pom.xml ./pom.xml
RUN mvn -B -q dependency:go-offline
COPY backend/src ./src

# The editable React application is the production homepage. It preserves the
# supplied HAR visual language and connects directly to the Spring Boot APIs.
RUN rm -rf ./src/main/resources/static \
    && mkdir -p ./src/main/resources/static
COPY --from=frontend-build /frontend/dist/ ./src/main/resources/static/

# Reject the separate dark V2.3 portal and verify the HAR copy is present.
RUN test -f ./src/main/resources/static/index.html \
    && test -f ./src/main/resources/static/favicon.svg \
    && grep -R -q "trusted buses across Bangladesh" ./src/main/resources/static \
    && ! grep -R -q "secure seat locking" ./src/main/resources/static \
    && ! grep -q 'src="/app/' ./src/main/resources/static/index.html

RUN mvn -B -DskipTests package

# Verify the actual packaged application, not only the staging directory.
RUN rm -rf /tmp/jar-check \
    && mkdir -p /tmp/jar-check \
    && cd /tmp/jar-check \
    && jar xf /workspace/target/busbd-intelligence-1.0.0.jar \
    && test -f BOOT-INF/classes/static/index.html \
    && grep -R -q "trusted buses across Bangladesh" BOOT-INF/classes/static \
    && ! grep -R -q "secure seat locking" BOOT-INF/classes/static \
    && ! grep -q 'src="/app/' BOOT-INF/classes/static/index.html

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S busbd && adduser -S busbd -G busbd
COPY --from=backend-build /workspace/target/busbd-intelligence-1.0.0.jar app.jar
USER busbd
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
