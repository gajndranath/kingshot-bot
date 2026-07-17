const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const translationCache = require('../../utils/translationCache');
const { checkRateLimit } = require('../../middlewares/rateLimit');
const { checkSubscription } = require('../../middlewares/checkSubscription');
const translate = require('google-translate-api-x');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Translate')
    .setType(ApplicationCommandType.Message),

  async execute(interaction, client) {
    if (!(await checkRateLimit(interaction))) return;
    if (!(await checkSubscription(interaction))) return;

    // Acknowledge the interaction immediately as ephemeral
    await interaction.deferReply({ flags: 64 });

    try {
      const targetMessage = interaction.targetMessage;
      let textToTranslate = targetMessage.content;
      
      if (!textToTranslate || textToTranslate.trim() === '') {
        return interaction.editReply('❌ There is no text in this message to translate.');
      }

      if (textToTranslate.length > 1000) {
        return interaction.editReply('❌ **Message too long!** The translator only supports up to 1000 characters per message.');
      }

      // Detect user's Discord app language (e.g., 'en-US' -> 'en')
      let targetLang = interaction.locale.split('-')[0];
      
      // Fallback to English if locale is missing
      if (!targetLang) targetLang = 'en';

      // Call Google Translate Free API directly from Node.js (No AI Tokens used!)
      const res = await translate(textToTranslate, { to: targetLang });

      const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('🌍 Translation (Free Tier)')
        .setDescription(res.text)
        .setFooter({ text: `Translated from ${res.from.language.iso.toUpperCase()} to ${targetLang.toUpperCase()}` });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error(error, 'Translation Error');
      return interaction.editReply('❌ Translation failed. Please try again later.');
    }
  },
};
