# =============================================
# WaaS CMS Engine — Multi-Stage Docker Build
# Builds frontend + server, runs on Node 22
# =============================================

# ---- Stage 1: Build Frontend ----
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Production Server ----
FROM node:22-alpine

WORKDIR /app

RUN mkdir -p /app/server/data

# Server deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev

# Server source
COPY server/ ./server/

# Built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

WORKDIR /app/server
CMD ["node", "index.js"]
