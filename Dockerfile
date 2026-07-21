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

# Keep the editable V2.3 application isolated under /app so it can never
# overwrite the exact HAR-captured public homepage at the site root.
RUN rm -rf ./src/main/resources/static \
    && mkdir -p ./src/main/resources/static/app
COPY --from=frontend-build /frontend/dist/ ./src/main/resources/static/app/

# Copy the supplied original frontend LAST. This order is intentional.
COPY original-frontend/index.html ./src/main/resources/static/index.html
COPY original-frontend/favicon.svg ./src/main/resources/static/favicon.svg
COPY original-frontend/assets/ ./src/main/resources/static/assets/

# Fail the image build when the root page is not the supplied original design.
RUN grep -q "trusted buses across Bangladesh" ./src/main/resources/static/index.html \
    && ! grep -q "secure seat locking" ./src/main/resources/static/index.html \
    && test -f ./src/main/resources/static/assets/index-DCIpn-Yu.css \
    && test -f ./src/main/resources/static/assets/page-B2LLXDdi.js \
    && test -f ./src/main/resources/static/app/index.html

RUN mvn -B -DskipTests package

# Verify the packaged Spring Boot JAR, not only the source staging directory.
RUN rm -rf /tmp/jar-check \
    && mkdir -p /tmp/jar-check \
    && cd /tmp/jar-check \
    && jar xf /workspace/target/busbd-intelligence-1.0.0.jar \
    && grep -q "trusted buses across Bangladesh" BOOT-INF/classes/static/index.html \
    && ! grep -q "secure seat locking" BOOT-INF/classes/static/index.html \
    && test -f BOOT-INF/classes/static/assets/index-DCIpn-Yu.css \
    && test -f BOOT-INF/classes/static/assets/page-B2LLXDdi.js \
    && test -f BOOT-INF/classes/static/app/index.html

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S busbd && adduser -S busbd -G busbd
COPY --from=backend-build /workspace/target/busbd-intelligence-1.0.0.jar app.jar
USER busbd
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
