const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-event')
    .setDescription('Edit an existing scheduled event (R4/R5 only).')
    .addStringOption(option => option.setName('event_id').setDescription('The ID found at the bottom of the Event Embed').setRequired(true))
    .addStringOption(option => option.setName('new_date').setDescription('Format: YYYY-MM-DD').setRequired(false))
    .addStringOption(option => option.setName('new_time_utc').setDescription('Format: HH:MM (in UTC / Game Time)').setRequired(false))
    .addStringOption(option => option.setName('new_description').setDescription('Optional details to update').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const eventId = interaction.options.getString('event_id');
    const newDateStr = interaction.options.getString('new_date');
    const newTimeStr = interaction.options.getString('new_time_utc');
    const newDesc = interaction.options.getString('new_description');

    await interaction.deferReply({ flags: 64 });

    try {
      // Security Check
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.editReply({ content: '⛔ Only verified R4 or R5 officials can edit events.' });
      }

      // Fetch Existing Event
      const existingEvent = await client.prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!existingEvent || existingEvent.guild_id !== guildId) {
        return interaction.editReply({ content: '❌ Event not found. Make sure you copied the correct Event ID from the footer.' });
      }

      // Calculate New Time (if provided)
      let finalScheduledTime = existingEvent.scheduled_time;
      
      if (newDateStr || newTimeStr) {
        // If they provided one but not both, we extract the missing one from the old date
        const oldIso = existingEvent.scheduled_time.toISOString(); // e.g. "2026-07-20T14:30:00.000Z"
        const oldDatePart = oldIso.split('T')[0];
        const oldTimePart = oldIso.split('T')[1].substring(0, 5); // "14:30"

        const finalDate = newDateStr || oldDatePart;
        const finalTime = newTimeStr || oldTimePart;
        
        const dateTimeString = `${finalDate}T${finalTime}:00Z`;
        finalScheduledTime = new Date(dateTimeString);

        if (isNaN(finalScheduledTime.getTime())) {
          return interaction.editReply({ content: '❌ Invalid Date or Time format. Use YYYY-MM-DD and HH:MM.' });
        }

        if (finalScheduledTime < new Date()) {
          return interaction.editReply({ content: '❌ You cannot reschedule an event to the past.' });
        }
      }

      const finalDescription = newDesc || existingEvent.description;

      // Update Database
      await client.prisma.event.update({
        where: { id: eventId },
        data: {
          scheduled_time: finalScheduledTime,
          description: finalDescription,
          reminder_sent: false // Reset reminder so it fires again!
        }
      });

      // Fetch current RSVP stats to include in the new embed
      const rsvps = await client.prisma.eventRSVP.findMany({
        where: { event_id: eventId }
      });

      let infCount = 0;
      let lanCount = 0;
      let marCount = 0;

      rsvps.forEach(rsvp => {
        if (rsvp.troop_type === 'INFANTRY') infCount++;
        if (rsvp.troop_type === 'LANCER') lanCount++;
        if (rsvp.troop_type === 'MARKSMAN') marCount++;
      });

      // Generate New Embed
      const unixTime = Math.floor(finalScheduledTime.getTime() / 1000);
      
      const embed = new EmbedBuilder()
        .setColor('#E67E22') // Orange for Edited
        .setTitle(`🔄 UPDATED EVENT: ${existingEvent.name}`)
        .setDescription(`${finalDescription}\n\n**RSVP Roster:**\n🛡️ Infantry: ${infCount}\n🐎 Lancers: ${lanCount}\n🏹 Marksmen: ${marCount}`)
        .addFields(
          { name: 'Starts At (Local Time)', value: `<t:${unixTime}:F>`, inline: false },
          { name: 'Countdown', value: `<t:${unixTime}:R>`, inline: false }
        )
        .setFooter({ text: `Updated by ${interaction.user.username} | ID: ${eventId}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rsvp_INFANTRY_${eventId}`).setLabel('🛡️ Infantry').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rsvp_LANCER_${eventId}`).setLabel('🐎 Lancer').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rsvp_MARKSMAN_${eventId}`).setLabel('🏹 Marksman').setStyle(ButtonStyle.Primary)
      );

      // Post the new updated event message
      const channel = await client.channels.fetch(existingEvent.channel_id).catch(() => null);
      if (channel) {
        await channel.send({ content: '@everyone ⚠️ **This event has been UPDATED!** (Please delete the old event message above).', embeds: [embed], components: [row] });
        return interaction.editReply({ content: `✅ Event updated successfully!` });
      } else {
        return interaction.editReply({ content: `✅ Event updated in database, but I could not find the original channel to post the new schedule.` });
      }

    } catch (error) {
      logger.error(error, 'Edit Event Error');
      return interaction.editReply({ content: 'An error occurred while editing the event.' });
    }
  }
};
