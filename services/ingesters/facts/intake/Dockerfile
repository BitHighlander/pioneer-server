# Multi-stage Dockerfile
FROM node:20-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine as runtime

WORKDIR /app

# Copy only necessary files from the build stage
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist/ ./dist/

# Install only production dependencies
RUN npm ci --only=production

# Set environment variables for Node.js
ENV NODE_ENV=production

# Optimize Node.js for production
RUN npm prune --production

# Run the application
CMD [ "node", "./dist/index.js" ]
