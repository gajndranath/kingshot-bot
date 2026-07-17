const logger = require('../utils/logger');

const AI_BRAIN_URL = 'http://localhost:8000/api';

async function processWithFastAPI(text) {
  try {
    const response = await fetch(`${AI_BRAIN_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    if (!response.ok) throw new Error('FastAPI translation failed');
    return await response.json();
  } catch (error) {
    logger.error(error, 'FastAPI Translation Error');
    return { translatedText: null };
  }
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    // Bottleneck Fix: Only trigger translation if explicitly requested to save API limits.
    if (message.content.startsWith('!translate ')) {
      const textToTranslate = message.content.slice(11).trim();
      if (!textToTranslate) return;

      try {
        const aiResponse = await processWithFastAPI(textToTranslate);

        if (aiResponse.translatedText) {
          await message.reply({ 
            content: `🗣️ **Translation:** ${aiResponse.translatedText}`, 
            allowedMentions: { repliedUser: false } 
          });
        }
      } catch (error) {
        logger.error(error, 'Message AI processing error');
      }
    }
  }
};
