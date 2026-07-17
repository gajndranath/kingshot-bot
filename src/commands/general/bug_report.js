const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

// REPLACE THIS WITH THE ID OF YOUR PRIVATE DEVELOPER DISCORD SERVER CHANNEL
const DEV_BUG_CHANNEL_ID = '098765432109876543'; 

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bug_report')
    .setDescription('Report a bug directly to the developer.')
    .addStringOption(option => 
      option.setName('description')
        .setDescription('Please describe the bug in detail')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('screenshot')
        .setDescription('Optional screenshot of the error')
        .setRequired(false)),
  
  async execute(interaction, client) {
    const description = interaction.options.getString('description');
    const screenshot = interaction.options.getAttachment('screenshot');

    await interaction.deferReply({ ephemeral: true });

    try {
      const devChannel = await client.channels.fetch(DEV_BUG_CHANNEL_ID).catch(() => null);
      
      if (!devChannel) {
        return interaction.editReply('❌ Cannot reach the developer network right now. Please try again later.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🐛 New Bug Report')
        .setDescription(`**Reporter:** <@${interaction.user.id}> (Guild: ${interaction.guild.name})\n**Details:** ${description}`)
        .setColor('#FF4500')
        .setTimestamp();

      if (screenshot) {
        embed.setImage(screenshot.url);
      }

      await devChannel.send({ embeds: [embed] });
      await interaction.editReply('✅ Thank you! Your bug report has been securely transmitted to the developer.');

    } catch (error) {
      logger.error(error, 'Error sending bug report');
      await interaction.editReply('❌ Failed to send bug report.');
    }
  }
};
