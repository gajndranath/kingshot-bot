FROM node:18-slim

# Install OpenSSL for Prisma engine compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY . .

# Webhook / API port
EXPOSE 4000

CMD ["node", "src/index.js"]
