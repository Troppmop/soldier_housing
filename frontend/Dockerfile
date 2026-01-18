FROM node:20-bullseye-slim AS builder
WORKDIR /app
# Copy entire context so build works whether the context is repo-root or ./frontend
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Install and build from the correct folder depending on context
RUN set -eux; \
	if [ -f frontend/package.json ]; then \
		cd frontend; \
		npm ci --no-audit --no-fund --no-optional || npm install --no-optional; \
		npm run build; \
	else \
		npm ci --no-audit --no-fund --no-optional || npm install --no-optional; \
		npm run build; \
	fi

FROM nginx:stable-alpine
# Copy built assets (try both possible locations)
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
