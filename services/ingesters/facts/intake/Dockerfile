# build stage
FROM --platform=linux/amd64 node:14 AS build

ARG NPM_TOKEN
RUN echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} > ./.npmrc

# Update the package lists and install required packages
RUN apt-get update \
    && apt-get install -y wget libudev-dev libusb-1.0-0 --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# Build the application
RUN npm run build

# production stage
FROM --platform=linux/amd64 node:14 AS production

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the built application from the build stage
COPY --from=build /app/dist ./dist

CMD [ "npm", "start" ]
