# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create logs directory
RUN mkdir -p logs

# Expose port (for health checks)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]

