FROM node:20-bullseye-slim
WORKDIR /app
# Support repo-root build contexts by copying from frontend/ when present
COPY frontend/package.json frontend/package-lock.json* ./
# Avoid installing optional native binaries (can fail on musl/alpine). Use
# a Debian-based image to keep rollup native bindings compatible in CI.
RUN npm ci --no-audit --no-fund --no-optional || npm install --no-optional
COPY frontend/. ./
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
ENV HOST 0.0.0.0
CMD ["npx", "serve", "-s", "dist", "-l", "5173"]
