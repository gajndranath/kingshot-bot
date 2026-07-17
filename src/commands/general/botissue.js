const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

// REPLACE THIS WITH THE ID OF YOUR PRIVATE DEVELOPER DISCORD SERVER CHANNEL
const DEV_BUG_CHANNEL_ID = '098765432109876543'; 

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botissue')
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

    await interaction.deferReply({ flags: 64 });

    try {
      await client.prisma.feedback.create({
        data: {
          guild_id: interaction.guildId,
          user_id: interaction.user.id,
          issue_text: description,
          is_resolved: false
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Feedback Submitted')
        .setDescription(`Thank you <@${interaction.user.id}>! Your issue has been logged directly to the Developer's Admin Portal.`)
        .setColor('#10b981')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error(error, 'Error logging feedback');
      await interaction.editReply('❌ Failed to submit feedback to the portal.');
    }
  }
};
