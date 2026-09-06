FROM docker.io/library/node:20-alpine

WORKDIR /usr/src/app
COPY --chown=node:node package.json server.js ./
USER node
RUN npm install --omit=dev

EXPOSE 8080
CMD ["node", "server.js"]
