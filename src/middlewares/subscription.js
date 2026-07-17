/**
 * Subscription Lock Middleware
 */

/**
 * Checks if the guild has an active premium subscription or trial.
 * @param {import('discord.js').Interaction} interaction 
 * @param {import('@prisma/client').PrismaClient} prisma 
 * @returns {Promise<boolean>} True if authorized, false otherwise.
 */
async function requirePremium(interaction, prisma) {
  const sub = await prisma.subscription.findUnique({
    where: { guild_id: interaction.guildId }
  });

  if (!sub) {
    await interaction.reply({ content: '🔒 Your server has not been initialized. An admin must run `/setup` first.', flags: 64 });
    return false;
  }

  if (sub.is_premium) {
    return true; // Unlocked
  }

  // Check if trial has expired
  const now = new Date();
  if (now > sub.trial_expires) {
    await interaction.reply({ 
      content: '🔒 **Your 7-Day Trial has expired.**\n\nThe R5 must purchase a premium subscription to unlock AI features.\nVisit: https://kingshot-bot.example.com/pricing', 
      flags: 64 
    });
    return false;
  }

  return true;
}

module.exports = {
  requirePremium
};
