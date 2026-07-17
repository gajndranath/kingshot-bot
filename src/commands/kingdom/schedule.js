const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule an alliance event via Pop-up Form (R4/R5 only)')
    .addChannelOption(option => 
      option.setName('target_channel')
        .setDescription('Optional: Select a specific channel to post this event')
        .addChannelTypes(0)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),
    
  async execute(interaction, client) {
    try {
      const targetChannel = interaction.options.getChannel('target_channel');
      
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4 or R5 officials can use this command.', flags: 64 });
      }

      const modalId = targetChannel ? `modal_schedule_${targetChannel.id}` : 'modal_schedule_DEFAULT';

      const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle('📅 Schedule Event');

      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('event_name').setLabel('Event Name').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('event_date').setLabel('Date (YYYY-MM-DD)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('event_time').setLabel('UTC Time (HH:MM)').setStyle(TextInputStyle.Short).setRequired(true))
      );
      
      await interaction.showModal(modal);

    } catch (error) {
      logger.error(error, 'Schedule Command Error');
      await interaction.reply({ content: '❌ Could not open the schedule form.', flags: 64 });
    }
  },
};
