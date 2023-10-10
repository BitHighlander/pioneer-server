#uncomment ONLY on M1 mac (rolls eyes)
FROM --platform=linux/amd64 node:14.16.0
#FROM --platform=linux/amd64 node:16.13.2
#FROM --platform=linux/amd64 node:20.1.0

#RUN apt-get update && apt-get install -y chromium

ARG NPM_TOKEN
ARG NODE_ENV

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app/

#NPM_TOKEN used for private packages
RUN echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} > /usr/src/app/.npmrc
RUN npm install -g npm@6
RUN npm --version
#copy all files except node_modules folder
COPY . .
RUN npm install
RUN npm run build:all-stage

# Set environment variables
#ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium
#ENV CHROME_BIN /usr/bin/chromium

#ENV NODE_ENV docker
#ENV CHROME_PATH /usr/lib/chromium/

#start
CMD [ "npm", "run", "start" ]
