FROM node:20-bullseye-slim
WORKDIR /app
# Support repo-root build contexts by copying from frontend/ when present
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund --omit=optional || npm install --omit=optional --no-audit --no-fund
COPY frontend/. ./
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
ENV HOST 0.0.0.0
CMD ["npx", "serve", "-s", "dist", "-l", "5173"]
