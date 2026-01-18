FROM node:20-bullseye-slim AS builder
WORKDIR /app
# Copy entire context so build works whether context is repo root or ./frontend
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Use Yarn for a more predictable install of JS deps (avoids some npm optional-deps issues)
RUN set -eux; \
		npm install -g yarn@1.22.19; \
		if [ -f frontend/package.json ]; then \
			cd frontend; \
			yarn install --network-concurrency 1; \
			yarn build; \
		else \
			yarn install --network-concurrency 1; \
			yarn build; \
		fi

FROM nginx:stable-alpine AS runner
# Use a simple nginx config with SPA fallback to index.html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Copy built assets from builder (support both possible build locations)
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html
# Ensure nginx can read the files
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]