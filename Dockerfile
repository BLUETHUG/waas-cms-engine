# =============================================
# WaaS CMS Engine — Production Docker Build
# Single stage: copies pre-built frontend
# =============================================

FROM node:22-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Copy server source
COPY server/ ./server/

# Copy pre-built frontend (built outside Docker)
COPY frontend/dist/ ./frontend/dist/

# Create data directory for persistent volume
RUN mkdir -p /app/server/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

WORKDIR /app/server
CMD ["node", "index.js"]
