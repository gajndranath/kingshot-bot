const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('publish-verify')
    .setDescription('Publishes a permanent Self-Verification panel with a button.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🛡️ Kingshot OS - Identity Verification')
      .setDescription('To use this Discord Server fully and access AI features, you must link your in-game identity.\n\n**Existing Members:** Click the button below, enter your In-Game Name, and you will be auto-verified!\n**New Members:** Your request will be sent to an R4 for approval.')
      .setFooter({ text: 'Kingshot Alliance System' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ui_verify_me')
          .setLabel('Link Identity (Verify)')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔗')
      );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Verification panel published successfully.', flags: 64 });
  }
};
