# BusBD Intelligence

Clean production package for the recovered BusBD Intelligence frontend.

## Contents

- Static HTML frontend
- Compiled CSS and JavaScript
- Fonts and favicon
- Minimal Nginx Docker deployment
- Render Blueprint configuration

## Run locally with Docker

```bash
docker build -t busbd-intelligence .
docker run --rm -p 10000:10000 -e PORT=10000 busbd-intelligence
```

Open `http://localhost:10000/`.

## Deploy on the existing Render service

1. Remove the previous repository files.
2. Upload every extracted file and folder from this package to the repository root.
3. Commit to `main`.
4. In Render, open the existing service and choose **Manual Deploy > Deploy latest commit** if automatic deployment does not start.

The existing Render service remains Docker-based and will build this lightweight Nginx image instead of the previous Spring Boot application.
