const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware to check if the guild has an active subscription.
 * Blocks commands if trial has expired or marked as FRAUD.
 */
async function checkSubscription(interaction) {
  const guildId = interaction.guildId;
  
  try {
    const sub = await prisma.subscription.findUnique({
      where: { guild_id: guildId }
    });

    if (!sub) {
      // If no subscription record exists, allow them to continue (it will be created eventually, or maybe they haven't set up yet)
      return true;
    }

    if (sub.payment_status === 'FRAUD') {
      await interaction.reply({ 
        content: '⛔ **CRITICAL SECURITY ALERT:** Your server\'s Kingshot OS access has been permanently revoked due to billing fraud or Terms of Service violations.', 
        ephemeral: true 
      });
      return false;
    }

    if (!sub.is_premium) {
      const now = new Date();
      if (now > sub.trial_expires) {
        await interaction.reply({ 
          content: `⛔ **TRIAL EXPIRED:** Your server's Kingshot OS free trial expired on ${sub.trial_expires.toLocaleDateString()}.\n\n*Please ask your R5 to upgrade to a Premium plan to restore AI features.*`, 
          ephemeral: true 
        });
        return false;
      }
    }

    return true; // Subscription is valid
  } catch (error) {
    logger.error(error, 'Error checking subscription');
    // Fail-open strategy to prevent locking out users if database temporarily glitches
    return true; 
  }
}

module.exports = {
  checkSubscription
};
