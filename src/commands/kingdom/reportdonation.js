const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const { checkRateLimit } = require('../../middlewares/rateLimit');
const { checkSubscription } = require('../../middlewares/checkSubscription');
const { checkMode } = require('../../middlewares/checkMode');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report-donation')
    .setDescription('Upload a screenshot of alliance tech donations to scan for slackers.')
    .addAttachmentOption(option => 
      option.setName('screenshot')
        .setDescription('The screenshot of the alliance tech donation leaderboard')
        .setRequired(true)
    ),
    
  async execute(interaction, client) {
    if (!(await checkRateLimit(interaction))) return;
    if (!(await checkSubscription(interaction))) return;
    if (!(await checkMode(interaction, 'KINGDOM'))) return;

    const attachment = interaction.options.getAttachment('screenshot');
    const guildId = interaction.guildId;
    const discordId = interaction.user.id;

    if (!attachment.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '❌ Please upload a valid image file.', flags: 64 });
    }

    await interaction.deferReply();

    try {
      const member = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: discordId, guild_id: guildId } }
      });

      if (!member) {
        return interaction.editReply({ content: '❌ You must be registered to report donations.' });
      }

      // Send image to Python Brain
      const AI_BRAIN_URL = process.env.AI_BRAIN_URL || 'http://localhost:8000/api';
      const AI_BRAIN_API_KEY = process.env.AI_BRAIN_API_KEY || 'default-dev-key';
      
      const response = await fetch(`${AI_BRAIN_URL}/scan-donation`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': AI_BRAIN_API_KEY 
        },
        body: JSON.stringify({ image_url: attachment.url })
      });

      if (!response.ok) {
        return interaction.editReply({ content: '❌ Failed to reach the AI OCR Engine.' });
      }

      const result = await response.json();

      if (result.status === 'error') {
        return interaction.editReply({ content: `❌ **Scan Error:** ${result.message}` });
      }

      if (result.status === 'success') {
        const points = result.points;
        // In a real app, we might scale points down (e.g. 5000 donation points = 50 activity points)
        const activityPointsEarned = Math.floor(points / 100); 

        await client.prisma.member.update({
          where: { discord_id_guild_id: { discord_id: discordId, guild_id: guildId } },
          data: { activity_score: member.activity_score + activityPointsEarned }
        });

        return interaction.editReply({ 
          content: `✅ **Donation Verified!**\nOCR read **${points}** donation points from your screenshot.\n\nYou have been awarded **+${activityPointsEarned} Activity Points**!` 
        });
      }

    } catch (error) {
      logger.error(error, 'Report Donation OCR Error');
      await interaction.editReply({ content: 'An error occurred during the OCR scan.' });
    }
  },
};
