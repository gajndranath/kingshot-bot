const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Access professional Alliance Event Strategy Guides & Tutorials.'),
  
  async execute(interaction, client) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('📚 Alliance Strategy Guides')
        .setDescription('Welcome to the Kingshot War Academy. Click on an event below to instantly pull up the official strategy, troop requirements, and rules for winning the event.')
        .setColor('#3498db')
        .setThumbnail(interaction.client.user.displayAvatarURL())
        .setFooter({ text: 'Knowledge is Power' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('guide_bear_hunt').setLabel('🐻 Bear Hunt').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('guide_castle_siege').setLabel('🏰 Castle Siege').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('guide_kvk').setLabel('⚔️ KvK (SVS)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('guide_facility').setLabel('🛡️ Facility/Fortress').setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error(error, 'Guide Command Error');
      await interaction.reply({ content: '❌ Failed to load guides.', flags: 64 });
    }
  }
};
