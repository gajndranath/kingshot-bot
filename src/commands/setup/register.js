const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your in-game identity with the bot via a pop-up form.'),
  
  async execute(interaction, client) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('modal_register')
        .setTitle('Identity Verification');

      const nameInput = new TextInputBuilder()
        .setCustomId('in_game_name')
        .setLabel('Your exact Kingshot In-Game Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Joreth')
        .setRequired(true);

      const roleInput = new TextInputBuilder()
        .setCustomId('role')
        .setLabel('Your Role (Type: MEMBER, R4, or R5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('MEMBER')
        .setRequired(true);

      const tagInput = new TextInputBuilder()
        .setCustomId('alliance_tag')
        .setLabel('Your Alliance Tag (Optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., PHX')
        .setRequired(false);

      const row1 = new ActionRowBuilder().addComponents(nameInput);
      const row2 = new ActionRowBuilder().addComponents(roleInput);
      const row3 = new ActionRowBuilder().addComponents(tagInput);

      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error(error, 'Failed to show register modal');
      await interaction.reply({ content: '❌ Could not open the registration form.', flags: 64 });
    }
  }
};
