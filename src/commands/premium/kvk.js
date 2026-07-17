const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { processVisionPrompt } = require('../../services/aiRouter');
const { requirePremium } = require('../../middlewares/subscription');
const { checkRateLimit } = require('../../middlewares/rateLimit');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kvk')
    .setDescription('Submit your KvK Kills using a battle report screenshot')
    .addAttachmentOption(option => 
      option.setName('screenshot')
        .setDescription('Screenshot of your final battle report')
        .setRequired(true)),
  
  async execute(interaction, client) {
    if (!(await checkRateLimit(interaction))) return;

    // SaaS Security: 1st time free logic
    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
    });

    if (!member || !member.is_verified) {
      return interaction.reply({ content: '⛔ You must be a verified member to submit KvK scores.', flags: 64 });
    }

    // Assume we track total_kvk_submissions on Member, if 0 it's free. Else check premium.
    const hasFreeUsage = !member.has_used_free_kvk; 
    
    // Custom premium check to allow free usage without triggering the middleware reply
    const sub = await client.prisma.subscription.findUnique({ where: { guild_id: interaction.guildId } });
    let isPremium = false;
    if (sub) {
      if (sub.is_premium) isPremium = true;
      else if (new Date() <= sub.trial_expires) isPremium = true;
    }

    if (!isPremium && !hasFreeUsage) {
      return interaction.reply({ 
        content: '🔒 **Your 7-Day Trial has expired and you have used your 1 Free Pass.**\n\nThe R5 must purchase a premium subscription to unlock AI features.', 
        flags: 64 
      });
    }

    const screenshot = interaction.options.getAttachment('screenshot');
    if (!screenshot.contentType.startsWith('image/')) {
      return interaction.reply({ content: 'Please upload a valid image file.', flags: 64 });
    }

    await interaction.deferReply();

    // Mark free usage as used if they weren't premium
    if (!isPremium && hasFreeUsage) {
      await client.prisma.member.update({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
        data: { has_used_free_kvk: true }
      });
    }

    try {
      const prompt = "Analyze this Kingshot battle report screenshot. Return a JSON object with 'in_game_name' (string) and 'kills' (integer).";
      
      const aiData = await processVisionPrompt(prompt, screenshot.url);
      
      // Basic security: Ensure the name in the screenshot matches the registered DB name
      // Using lowercase comparison for leniency
      if (aiData.in_game_name && aiData.in_game_name.toLowerCase() !== member.in_game_name.toLowerCase()) {
        return interaction.editReply(`❌ **Identity Mismatch:** The screenshot name (${aiData.in_game_name}) does not match your registered name (${member.in_game_name}).`);
      }

      // We'd typically store this in a 'KvKKills' table
      // For demonstration, we'll just acknowledge the submission
      
      const embed = new EmbedBuilder()
        .setTitle('⚔️ KvK Kills Logged')
        .setDescription(`Successfully logged kills for **${member.in_game_name}**.`)
        .addFields(
          { name: 'Kills Extracted', value: aiData.kills ? aiData.kills.toLocaleString() : '0' }
        )
        .setColor('#FFA500')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // In a full system, here we would update a pinned Leaderboard Embed in the #war-room channel.

    } catch (error) {
      if (error.message === 'DUPLICATE_IMAGE_FRAUD') {
        return interaction.editReply('❌ **Fraud Detected:** You cannot submit the same battle report twice.');
      }
      logger.error(error, 'Error in KvK Vision processing');
      await interaction.editReply('❌ Failed to process the report. Ensure the image is clear.');
    }
  }
};
