FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    sqlite3 libsqlite3-dev python3 python3-pip make g++

RUN pip3 install setuptools

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "app.js"]