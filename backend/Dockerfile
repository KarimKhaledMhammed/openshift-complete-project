# Backend Dockerfile - Multi-stage build
# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for building if needed, though we don't build TS here)
# Using generic install to be safe
# Upgrade npm to fix vulnerabilities in bundled dependencies
RUN npm install -g npm@latest
RUN npm install

# Prune dev dependencies to save space
RUN npm prune --production

# Stage 2: Runtime
FROM node:20-alpine
RUN apk update && apk upgrade && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /usr/src/app

# Copy dependencies from builder (now only production)
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules

# Copy application code
COPY --chown=node:node . .

# Metadata
LABEL maintainer="student@example.com" \
    version="1.0" \
    description="Bookstore Backend API"

# Set environment to production
ENV NODE_ENV=production

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start application
CMD ["node", "server.js"]
