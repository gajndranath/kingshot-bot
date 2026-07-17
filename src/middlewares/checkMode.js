const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware to restrict commands based on guild mode (SOLO vs KINGDOM).
 * @param {object} interaction - The discord.js interaction object
 * @param {string} requiredMode - The required mode ('SOLO' or 'KINGDOM')
 * @returns {boolean} - Returns true if the command is allowed, false if blocked.
 */
async function checkMode(interaction, requiredMode) {
  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guild_id: interaction.guildId }
    });

    if (!config) {
      // Not setup yet, better to allow or block? We block to force setup.
      await interaction.reply({ 
        content: `❌ This server is not configured yet. Please ask an Admin to run \`/setup\` first.`, 
        flags: 64 
      });
      return false;
    }

    if (config.mode !== requiredMode) {
      await interaction.reply({ 
        content: `❌ **Command Blocked:** This command is only available in **${requiredMode}** mode. Your server is running in **${config.mode}** mode.`, 
        flags: 64 
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in checkMode:', error);
    return true; // Fail open
  }
}

module.exports = { checkMode };
