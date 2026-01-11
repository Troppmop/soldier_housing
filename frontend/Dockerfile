FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install
COPY . .
RUN npm run build
ENV HOST 0.0.0.0
CMD ["npx", "serve", "-s", "dist", "-l", "5173"]
