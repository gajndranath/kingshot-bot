const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule an alliance event via Interactive Dashboard (R4/R5 only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),
    
  async execute(interaction, client) {
    try {
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4 or R5 officials can use this command.', flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setTitle('📅 Event Scheduler')
        .setDescription('Welcome to the Event Scheduler.\n\n1️⃣ Select a **Target Channel** (Optional - Uses Default).\n2️⃣ Click **Proceed** to enter event details.')
        .setColor('#e67e22');

      const channelMenu = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('ui_schedule_channel')
          .setPlaceholder('1️⃣ Target Channel (Optional - Uses Default)')
          .setChannelTypes(ChannelType.GuildText)
      );

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_schedule_modal')
          .setLabel('2️⃣ Proceed to Scheduler')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [embed], components: [channelMenu, buttonRow], flags: 64 });

    } catch (error) {
      logger.error(error, 'Failed to show schedule dashboard');
      await interaction.reply({ content: '❌ Could not open the schedule dashboard.', flags: 64 });
    }
  }
};
