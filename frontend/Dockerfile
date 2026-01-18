FROM node:20-bullseye-slim AS builder
WORKDIR /app
# Copy entire context so build works whether context is repo root or ./frontend
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Use yarn if available; otherwise fall back to npm. Avoid installing global yarn
RUN set -eux; \
		if command -v yarn >/dev/null 2>&1; then \
			if [ -f frontend/package.json ]; then \
				cd frontend; \
				yarn install --network-concurrency 1; \
				yarn build; \
			else \
				yarn install --network-concurrency 1; \
				yarn build; \
			fi; \
		else \
			if [ -f frontend/package.json ]; then \
				cd frontend; \
				npm ci --no-audit --no-fund --no-optional || npm install --no-optional --no-audit --no-fund; \
				npm run build; \
			else \
				npm ci --no-audit --no-fund --no-optional || npm install --no-optional --no-audit --no-fund; \
				npm run build; \
			fi; \
		fi; \
		# Ensure a canonical /app/dist exists for the runner stage regardless of where build wrote files
		mkdir -p /app/dist; \
		if [ -d frontend/dist ]; then \
			cp -r frontend/dist/. /app/dist/; \
		elif [ -d dist ]; then \
			cp -r dist/. /app/dist/; \
		fi

FROM nginx:stable-alpine AS runner
# Use a simple nginx config template with SPA fallback to index.html
# Copy as a template so docker-entrypoint can substitute $PORT at container start
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
# Copy built assets from builder (support both possible build locations)
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html
# Ensure nginx can read the files
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]