const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botissue')
    .setDescription('Report a bug directly to the developer via Pop-up Form.'),
  
  async execute(interaction, client) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('modal_botissue')
        .setTitle('🐛 Report a Bug');

      const descInput = new TextInputBuilder()
        .setCustomId('issue_description')
        .setLabel('Describe the bug in detail')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('What happened? How can we reproduce it?')
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('issue_image_url')
        .setLabel('Image URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://example.com/screenshot.png')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(imageInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      logger.error(error, 'Failed to show botissue modal');
      await interaction.reply({ content: '❌ Could not open the bug report form.', flags: 64 });
    }
  }
};
