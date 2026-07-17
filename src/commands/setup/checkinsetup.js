const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkin-setup')
    .setDescription('Spawn the Daily Check-in button (R5 only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  async execute(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📅 Daily Alliance Check-in')
        .setDescription('Busy at work? Not a big chatter? No problem!\n\nClick the button below once every 24 hours to silently claim **+5 Activity Points** and stay off the auto-kick list.')
        .setFooter({ text: 'Kingshot Bot • Activity System' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('daily_checkin')
          .setLabel('✅ Claim Daily Points')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ content: 'Check-in panel spawned!', flags: 64 });
      await interaction.channel.send({ embeds: [embed], components: [row] });

    } catch (error) {
      logger.error(error, 'Check-in setup error');
      await interaction.reply({ content: 'Error spawning the panel.', flags: 64 });
    }
  },
};
