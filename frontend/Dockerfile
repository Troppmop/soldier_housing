FROM node:20-alpine
WORKDIR /app
# Support repo-root build contexts by copying from frontend/ when present
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install
COPY frontend/. ./
RUN npm run build
ENV HOST 0.0.0.0
CMD ["npx", "serve", "-s", "dist", "-l", "5173"]
