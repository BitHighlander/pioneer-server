FROM node:14.16.0

ARG NPM_TOKEN
ARG NODE_ENV

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app/

RUN echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} > /usr/src/app/.npmrc
RUN npm install -g @quasar/cli
RUN npm install

COPY . /usr/src/app
RUN npm run build:all-stage

ENV NODE_ENV docker

#start
CMD [ "npm", "run", "start" ]
