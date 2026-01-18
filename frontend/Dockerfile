FROM node:20-bullseye-slim AS builder
WORKDIR /app
# Copy only frontend package files first for a clean install
COPY frontend/package.json frontend/package-lock.json* ./
# Install dependencies without optional native binaries to avoid rollup native module issues
RUN npm ci --no-audit --no-fund --no-optional || npm install --no-optional
# Copy frontend source and build
COPY frontend/. ./
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:stable-alpine
# Copy built assets (try both possible locations)
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
