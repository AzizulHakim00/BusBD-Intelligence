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

# Package the editable, functional HAR-styled React application at the root.
RUN rm -rf ./src/main/resources/static \
    && mkdir -p ./src/main/resources/static
COPY --from=frontend-build /frontend/dist/ ./src/main/resources/static/

# Reject the obsolete dark portal and verify required public files.
RUN test -f ./src/main/resources/static/index.html \
    && test -f ./src/main/resources/static/favicon.svg \
    && test -f ./src/main/resources/static/deployment.json \
    && grep -R -q "trusted buses across Bangladesh" ./src/main/resources/static \
    && grep -q '"frontend": "functional-har-design"' ./src/main/resources/static/deployment.json \
    && ! grep -R -q "secure seat locking" ./src/main/resources/static \
    && ! grep -q 'src="/app/' ./src/main/resources/static/index.html

RUN mvn -B -DskipTests package

# Verify the final Spring Boot JAR contains the same frontend files.
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
COPY infrastructure/render-entrypoint.sh /app/render-entrypoint.sh
RUN chmod 755 /app/render-entrypoint.sh \
    && chown busbd:busbd /app/render-entrypoint.sh /app/app.jar
USER busbd
EXPOSE 8080

# Stay safely below the Render Free memory ceiling and reduce startup pressure.
ENV JAVA_OPTS="-Xms64m -Xmx256m -XX:+UseSerialGC -XX:ActiveProcessorCount=1 -Djava.security.egd=file:/dev/./urandom"

# The entrypoint keeps Neon as the primary database. When explicitly enabled,
# it falls back to the seeded H2 demo database instead of allowing a stale
# external database secret to cancel the entire Render deployment.
ENTRYPOINT ["/app/render-entrypoint.sh"]
