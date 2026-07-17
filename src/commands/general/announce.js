const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an official Alliance Announcement via Pop-up Form (R4/R5 only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, client) {
    try {
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4 or R5 officials can use this command.', flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_announce')
        .setTitle('📢 Create Announcement');

      const titleInput = new TextInputBuilder()
        .setCustomId('announce_title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. Alliance Rules Update')
        .setRequired(true);

      const messageInput = new TextInputBuilder()
        .setCustomId('announce_message')
        .setLabel('Announcement Message')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type your official announcement here...')
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('announce_image')
        .setLabel('Image URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://example.com/image.png')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(messageInput),
        new ActionRowBuilder().addComponents(imageInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      logger.error(error, 'Failed to show announce modal');
      await interaction.reply({ content: '❌ Could not open the announcement form.', flags: 64 });
    }
  }
};
