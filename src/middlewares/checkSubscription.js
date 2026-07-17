const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// List of commands that are strictly premium and require plan validation
const PREMIUM_COMMANDS = [
  'reporthit', 'reportdonation', 'report-reward', 
  'export', 'kvk', 'analyzer', 'advisor', 'alliance-health'
];

/**
 * Middleware to check if the guild has access to a specific command.
 * Blocks premium commands if trial has expired or if the feature isn't in their plan.
 */
async function checkSubscription(interaction) {
  const guildId = interaction.guildId;
  const commandName = interaction.commandName;
  
  try {
    const sub = await prisma.subscription.findUnique({
      where: { guild_id: guildId },
      include: { plan: true }
    });

    if (!sub) return true; // Fail-open for new setups

    if (sub.status === 'FRAUD') {
      await interaction.reply({ 
        content: '⛔ **CRITICAL SECURITY ALERT:** Your server\'s access has been permanently revoked due to billing fraud or Terms of Service violations.', 
        ephemeral: true 
      });
      return false;
    }

    // If it's a FREE command, always allow it.
    if (!PREMIUM_COMMANDS.includes(commandName)) {
      return true;
    }

    // --- FROM THIS POINT, IT'S A PREMIUM COMMAND ---
    const now = new Date();
    const isTrialActive = sub.trial_expires && now < sub.trial_expires;

    // If on active trial, allow all premium commands
    if (isTrialActive) {
      return true;
    }

    // Trial expired, but no premium active
    if (!sub.is_premium || sub.status !== 'ACTIVE') {
      await interaction.reply({ 
        content: `⛔ **TRIAL EXPIRED:** Your free trial has ended.\n\n*Please ask your R5 to upgrade to a Premium plan to restore AI features.*`, 
        ephemeral: true 
      });
      return false;
    }

    // They have an active Premium Plan, let's verify if THIS specific command is allowed
    let allowedFeatures = [];
    try { 
      allowedFeatures = sub.plan?.features ? JSON.parse(sub.plan.features) : []; 
    } catch(e) {}

    if (!allowedFeatures.includes(commandName)) {
      await interaction.reply({ 
        content: `⛔ **UPGRADE REQUIRED:** Your alliance's current subscription plan (${sub.plan?.name || 'Unknown'}) does NOT include the \`/${commandName}\` feature.\n\n*Please upgrade your plan via the Web Admin Panel.*`, 
        ephemeral: true 
      });
      return false;
    }

    return true; // Subscription is valid AND feature is allowed
  } catch (error) {
    logger.error(error, 'Error checking subscription');
    return true; 
  }
}

module.exports = {
  checkSubscription
};
