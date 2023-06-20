# build stage
FROM node:alpine as build

ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ./.npmrc

# Install required dependencies
RUN apk update

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy only necessary files
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# production stage
FROM node:alpine

# Set the working directory
WORKDIR /app

# Copy the built application from the previous stage
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist/ ./dist/

# Install production dependencies only
RUN npm ci --only=production

# Run the application
CMD [ "npm", "start" ]
