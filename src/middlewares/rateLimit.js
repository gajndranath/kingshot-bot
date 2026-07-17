/**
 * Rate Limiting Middleware (Anti-Spam/DDoS)
 * Limits uploads/commands to 10 per minute per guild.
 */
const logger = require('../utils/logger');

const limits = new Map();

async function checkRateLimit(interaction) {
  const guildId = interaction.guildId;
  const now = Date.now();
  
  if (!limits.has(guildId)) {
    limits.set(guildId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  const record = limits.get(guildId);
  
  if (now > record.resetAt) {
    // Reset window
    record.count = 1;
    record.resetAt = now + 60000;
    return true;
  }

  if (record.count >= 10) {
    logger.warn(`Rate limit exceeded for guild: ${guildId}`);
    await interaction.reply({ content: '⛔ Rate Limit Exceeded: Your alliance can only submit 10 screenshots per minute. Please wait.', ephemeral: true });
    return false;
  }

  record.count++;
  return true;
}

module.exports = {
  checkRateLimit
};
