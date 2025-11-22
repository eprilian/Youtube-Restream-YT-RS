FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

RUN npm init -y
RUN npm install express socket.io sqlite3 body-parser cors

COPY . .

EXPOSE 3100

CMD ["node", "server.js"]