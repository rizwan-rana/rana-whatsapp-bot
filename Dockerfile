FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p auth_info

EXPOSE 3000

CMD ["node", "index.js"]
