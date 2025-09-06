# Simple Dockerfile for monorepo workspace
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install all dependencies (this handles workspace: protocol)
RUN npm install

# Build the API Gateway (this will also build dependencies)
RUN npm run build --workspace=@ai-feedback/api-gateway

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apigateway

# Change ownership of the app directory
RUN chown -R apigateway:nodejs /app

# Switch to non-root user
USER apigateway

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    http.get('http://localhost:3001/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

# Start the API Gateway
CMD ["node", "apps/api-gateway/dist/index.js"]