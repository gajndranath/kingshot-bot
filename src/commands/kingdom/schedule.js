const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule an event (in Game UTC Time) for all timezones.')
    .addStringOption(option => option.setName('title').setDescription('Event Title (e.g. Bear Hunt)').setRequired(true))
    .addStringOption(option => option.setName('date').setDescription('Format: YYYY-MM-DD').setRequired(true))
    .addStringOption(option => option.setName('time_utc').setDescription('Format: HH:MM (in UTC / Game Time)').setRequired(true))
    .addStringOption(option => option.setName('description').setDescription('Optional details').setRequired(false)),
    
  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const title = interaction.options.getString('title');
    const dateStr = interaction.options.getString('date');
    const timeStr = interaction.options.getString('time_utc');
    const desc = interaction.options.getString('description') || 'No description provided.';

    try {
      // Security Check
      const member = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });
      if (!member || (member.role !== 'R4' && member.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only R4/R5 can schedule events.', ephemeral: true });
      }

      // Parse UTC Time
      const dateTimeString = `${dateStr}T${timeStr}:00Z`;
      const scheduledTime = new Date(dateTimeString);

      if (isNaN(scheduledTime.getTime())) {
        return interaction.reply({ content: '❌ Invalid Date or Time format. Use YYYY-MM-DD and HH:MM.', ephemeral: true });
      }

      if (scheduledTime < new Date()) {
        return interaction.reply({ content: '❌ You cannot schedule an event in the past.', ephemeral: true });
      }

      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
      const channelId = config?.events_channel || interaction.channelId;

      // Save to Database
      const eventRecord = await client.prisma.event.create({
        data: {
          guild_id: guildId,
          name: title,
          description: desc,
          scheduled_time: scheduledTime,
          channel_id: channelId,
          created_by: interaction.user.id
        }
      });

      const unixTime = Math.floor(scheduledTime.getTime() / 1000);
      
      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle(`📅 Upcoming Event: ${title}`)
        .setDescription(`${desc}\n\n**RSVP Roster:**\n🛡️ Infantry: 0\n🐎 Lancers: 0\n🏹 Marksmen: 0`)
        .addFields(
          { name: 'Starts At (Local Time)', value: `<t:${unixTime}:F>`, inline: false },
          { name: 'Countdown', value: `<t:${unixTime}:R>`, inline: false }
        )
        .setFooter({ text: `Scheduled by ${interaction.user.username} | ID: ${eventRecord.id}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rsvp_INFANTRY_${eventRecord.id}`).setLabel('🛡️ Infantry').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rsvp_LANCER_${eventRecord.id}`).setLabel('🐎 Lancer').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rsvp_MARKSMAN_${eventRecord.id}`).setLabel('🏹 Marksman').setStyle(ButtonStyle.Primary)
      );

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) {
        await channel.send({ content: '@everyone A new event has been scheduled!', embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Event scheduled successfully in <#${channelId}>.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `✅ Event scheduled, but I could not find the events channel.`, embeds: [embed], components: [row] });
      }

    } catch (error) {
      logger.error(error, 'Schedule Command Error');
      await interaction.reply({ content: 'An error occurred while scheduling.', ephemeral: true });
    }
  },
};
