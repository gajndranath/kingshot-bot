const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule an event via Pop-up Form (in Game UTC Time).'),
    
  async execute(interaction, client) {
    try {
      const member = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
      });
      if (!member || (member.role !== 'R4' && member.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only R4/R5 can schedule events.', flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_schedule')
        .setTitle('Schedule an Event');

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
