# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Copy backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy source files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# ── Production ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy from build stage
COPY --from=base /app ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start server
CMD ["node", "backend/server.js"]
