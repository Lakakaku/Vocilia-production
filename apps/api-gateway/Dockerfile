# Multi-stage build for API Gateway
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for dependency installation
COPY package.json ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ai-evaluator/package.json ./packages/ai-evaluator/

# Install dependencies using npm install (not ci since no lock file)
RUN npm install --omit=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .
COPY turbo.json ./
COPY tsconfig.base.json ./

# Build the API Gateway and its dependencies
RUN npm run build --workspace=@ai-feedback/api-gateway

# Production image, copy all the files and run API Gateway
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3001

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apigateway

# Copy the built application
COPY --from=builder /app/apps/api-gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Copy package.json for running the app
COPY --from=builder /app/apps/api-gateway/package.json ./package.json

USER apigateway

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    http.get('http://localhost:3001/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

CMD ["node", "dist/index.js"]