FROM node:20-bullseye-slim
WORKDIR /app
# Support repo-root build contexts by copying from frontend/ when present
COPY frontend/package.json frontend/package-lock.json* ./
# Use Corepack to enable Yarn (more reliable handling of optional deps)
RUN corepack enable || true
RUN corepack prepare yarn@1.22.19 --activate || true
COPY frontend/package.json frontend/yarn.lock* ./
RUN if [ -f yarn.lock ]; then yarn install --network-concurrency 1 --frozen-lockfile || yarn install --network-concurrency 1; else npm ci --no-audit --no-fund --omit=optional || npm install --omit=optional --no-audit --no-fund; fi
COPY frontend/. ./
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV NPM_CONFIG_OPTIONAL=false
# remove any optional native rollup binaries that may have been installed accidentally
RUN rm -rf ./node_modules/@rollup/rollup-* || true
RUN npm run build
ENV HOST 0.0.0.0
CMD ["npx", "serve", "-s", "dist", "-l", "5173"]
