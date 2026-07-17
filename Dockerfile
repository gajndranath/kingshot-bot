FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY . .

# Webhook / API port
EXPOSE 4000

CMD ["node", "src/index.js"]
