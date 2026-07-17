const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const translationCache = require('../../utils/translationCache');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Translate')
    .setType(ApplicationCommandType.Message),

  async execute(interaction, client) {
    // Acknowledge the interaction immediately as ephemeral
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetMessage = interaction.targetMessage;
      const textToTranslate = targetMessage.content;
      const targetLocale = interaction.locale; // The native language of the user's Discord app

      if (!textToTranslate || textToTranslate.trim() === '') {
        return interaction.editReply({ content: '❌ There is no text to translate in this message.' });
      }

      // 1. Check Memory Cache
      const cachedTranslation = translationCache.get(targetMessage.id, targetLocale);
      if (cachedTranslation) {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setDescription(cachedTranslation)
          .setFooter({ text: `Translated to ${targetLocale} (Cached) ⚡` });
        return interaction.editReply({ embeds: [embed] });
      }

      // 2. Fetch from AI Brain
      const AI_BRAIN_URL = process.env.AI_BRAIN_URL || 'http://localhost:8000/api';
      const response = await fetch(`${AI_BRAIN_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, target_language: targetLocale })
      });

      if (!response.ok) {
        return interaction.editReply({ content: '❌ Failed to reach the AI Translation Engine.' });
      }

      const result = await response.json();
      
      if (result.status === 'error') {
        return interaction.editReply({ content: `❌ **Translation Error:** ${result.message}` });
      }

      const translatedText = result.translation;

      // 3. Save to Cache
      translationCache.set(targetMessage.id, targetLocale, translatedText);

      // 4. Send Ephemeral Embed
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setDescription(translatedText)
        .setFooter({ text: `Translated to ${targetLocale} via AI 🌐` });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error(error, 'Translation Context Menu Error');
      await interaction.editReply({ content: 'An error occurred during translation.' });
    }
  }
};
