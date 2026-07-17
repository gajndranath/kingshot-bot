const logger = require('../utils/logger');
const commandHandler = require('../handlers/commandHandler');

module.exports = {
  name: 'ready',
  once: true,
  /**
   * 
   * @param {import('discord.js').Client} client 
   */
  async execute(client) {
    logger.info(`[BOT] Logged in as ${client.user.tag}`);
    
    // Once the bot is ready, load and register commands
    await commandHandler(client);
  },
};
