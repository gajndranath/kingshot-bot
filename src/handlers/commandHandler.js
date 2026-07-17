const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Loads all commands from the src/commands folders and registers them with Discord.
 * @param {import('discord.js').Client} client 
 */
module.exports = async (client) => {
  const commands = [];
  const commandsPath = path.join(__dirname, '../commands');
  
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
    return;
  }

  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (folder === 'diplomacy') continue;
    if (!fs.lstatSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }

  // Register commands with Discord REST API
  if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      logger.info('Started refreshing application (/) commands.');
      
      // If GUILD_ID is provided, register to specific guild (faster for testing), else register globally
      if (process.env.GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
          { body: commands },
        );
      } else {
        await rest.put(
          Routes.applicationCommands(process.env.CLIENT_ID),
          { body: commands },
        );
      }
      
      logger.info(`Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) {
      logger.error(error, 'Command Registration Error');
    }
  } else {
    logger.warn('DISCORD_TOKEN or CLIENT_ID missing in .env. Skipping command registration.');
  }
};
