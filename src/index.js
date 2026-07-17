require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const logger = require('./utils/logger');

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
client.prisma = prisma;

// Load Events
const eventHandler = require('./handlers/eventHandler');
eventHandler(client);

// Initialize Cron Engine
const { initCronEngine } = require('./services/cronEngine');
initCronEngine(client);

// Initialize Payment Webhook Server
const { initPaymentWebhookServer } = require('./services/paymentWebhook');
initPaymentWebhookServer(prisma);

// Initialize Super Admin API
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { router: adminRouter, seedAdmin } = require('./api/admin');

const adminApp = express();
// Add Security Middleware
adminApp.use(helmet());
// Enable CORS for frontend
adminApp.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Securely restrict to Vercel URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
adminApp.use(express.json());
// Inject prisma into req
adminApp.use((req, res, next) => {
  req.prisma = prisma;
  next();
});
adminApp.use('/admin', adminRouter);

adminApp.listen(4000, async () => {
  logger.info('🛡️ Super Admin API listening on port 4000');
  await seedAdmin(prisma);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);
