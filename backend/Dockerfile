# Fly.io Dockerfile for Backend
FROM node:20-alpine

WORKDIR /app

# Install ALL dependencies (including dev for TypeScript build)
COPY package*.json ./
RUN npm install

# Copy source files needed for build
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Run the app
CMD ["node", "dist/index.js"]
