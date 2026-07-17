/**
 * Role-Based Access Control (RBAC) Middleware
 */

/**
 * Checks if the user is an R4 or R5 in the database.
 * @param {import('discord.js').Interaction} interaction 
 * @param {import('@prisma/client').PrismaClient} prisma 
 * @returns {Promise<boolean>} True if authorized, false otherwise.
 */
async function requireR4(interaction, prisma) {
  const member = await prisma.member.findUnique({
    where: {
      discord_id_guild_id: {
        discord_id: interaction.user.id,
        guild_id: interaction.guildId
      }
    }
  });

  if (!member || !member.is_verified) {
    await interaction.reply({ content: '⛔ You are not verified. Please use /register first.', ephemeral: true });
    return false;
  }

  if (member.role !== 'R4' && member.role !== 'R5') {
    await interaction.reply({ content: '⛔ You do not have permission to use this command. R4 or R5 required.', ephemeral: true });
    return false;
  }

  return true;
}

module.exports = {
  requireR4
};
