/**
 * Rate Limiting Middleware (Anti-Spam/DDoS)
 * Limits uploads/commands to 10 per minute per guild.
 */
const logger = require('../utils/logger');

const limits = new Map();

async function checkRateLimit(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const key = `${userId}_${guildId}`;
  const now = Date.now();
  
  if (!limits.has(key)) {
    limits.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }

  const record = limits.get(key);
  
  if (now > record.resetAt) {
    // Reset window
    record.count = 1;
    record.resetAt = now + 60000;
    return true;
  }

  if (record.count >= 10) {
    logger.warn(`Rate limit exceeded for user ${userId} in guild ${guildId}`);
    await interaction.reply({ content: '⛔ Rate Limit Exceeded: You can only use AI commands 10 times per minute. Please wait.', flags: 64 });
    return false;
  }

  record.count++;
  return true;
}

module.exports = {
  checkRateLimit
};
