FROM node:14.1

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 800

CMD ["node", "index.js"]