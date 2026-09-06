FROM node:alpine

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install

EXPOSE 8080

COPY . .

CMD ["sh", "-c", "node server.js"]
