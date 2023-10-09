# Uncomment ONLY on M1 mac
FROM --platform=linux/amd64 node:20.5.0

# Update npm to the latest version
RUN npm install -g npm@latest

ARG NPM_TOKEN
ARG NODE_ENV

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app/

# NPM_TOKEN used for private packages
RUN echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} > /usr/src/app/.npmrc

# Copy all files except node_modules folder
COPY . .
RUN npm install -g pnpm
RUN npm install
RUN npm run build:all-stage

CMD [ "npm", "run", "start" ]
