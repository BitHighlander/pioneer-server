#uncomment ONLY on M1 mac (rolls eyes)
#FROM --platform=linux/amd64 node:14.16.0
FROM --platform=linux/amd64 node:16.13.2

RUN apt-get update && apt-get install -y chromium


ARG NPM_TOKEN
ARG NODE_ENV

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app/

#NPM_TOKEN used for private packages
RUN echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} > /usr/src/app/.npmrc

#copy all files except node_modules folder
COPY . .
RUN npm run build:all-stage

ENV NODE_ENV docker

#start
CMD [ "npm", "run", "start" ]
