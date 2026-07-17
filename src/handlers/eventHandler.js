const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Loads all events from the src/events folder and attaches them to the Discord client.
 * @param {import('discord.js').Client} client 
 */
module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    return;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
  
  logger.info(`Loaded ${eventFiles.length} events successfully.`);
};
