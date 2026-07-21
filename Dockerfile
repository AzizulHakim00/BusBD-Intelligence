FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
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

# Reject the separate dark V2.3 portal and verify all required public files.
RUN test -f ./src/main/resources/static/index.html \
    && test -f ./src/main/resources/static/favicon.svg \
    && test -f ./src/main/resources/static/deployment.json \
    && grep -R -q "trusted buses across Bangladesh" ./src/main/resources/static \
    && grep -q '"frontend": "functional-har-design"' ./src/main/resources/static/deployment.json \
    && ! grep -R -q "secure seat locking" ./src/main/resources/static \
    && ! grep -q 'src="/app/' ./src/main/resources/static/index.html

RUN mvn -B -DskipTests package

# Verify the actual packaged application, not only the staging directory.
RUN rm -rf /tmp/jar-check \
    && mkdir -p /tmp/jar-check \
    && cd /tmp/jar-check \
    && jar xf /workspace/target/busbd-intelligence-1.0.0.jar \
    && test -f BOOT-INF/classes/static/index.html \
    && test -f BOOT-INF/classes/static/deployment.json \
    && grep -R -q "trusted buses across Bangladesh" BOOT-INF/classes/static \
    && grep -q '"frontend": "functional-har-design"' BOOT-INF/classes/static/deployment.json \
    && ! grep -R -q "secure seat locking" BOOT-INF/classes/static \
    && ! grep -q 'src="/app/' BOOT-INF/classes/static/index.html

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S busbd && adduser -S busbd -G busbd
COPY --from=backend-build /workspace/target/busbd-intelligence-1.0.0.jar app.jar
USER busbd
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=72.0"
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/actuator/health" | grep -q '"status":"UP"' || exit 1
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
