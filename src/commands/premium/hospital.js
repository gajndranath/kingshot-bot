const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { processVisionPrompt } = require('../../services/aiRouter');
const { requirePremium } = require('../../middlewares/subscription');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hospital')
    .setDescription('Scan your hospital capacity using Vision AI')
    .addAttachmentOption(option => 
      option.setName('screenshot')
        .setDescription('Screenshot of your hospital screen')
        .setRequired(true)),
  
  async execute(interaction, client) {
    // SaaS Security: Block if trial expired and not premium
    const isPremiumUnlocked = await requirePremium(interaction, client.prisma);
    if (!isPremiumUnlocked) return;

    const screenshot = interaction.options.getAttachment('screenshot');
    
    // Quick validation
    if (!screenshot.contentType.startsWith('image/')) {
      return interaction.reply({ content: 'Please upload a valid image file.', flags: 64 });
    }

    await interaction.deferReply();

    try {
      const prompt = "Analyze this Kingshot Hospital screenshot. Return a JSON object with 'wounded' and 'capacity' as integers.";
      
      const aiData = await processVisionPrompt(prompt, screenshot.url);
      
      const percentage = (aiData.wounded / aiData.capacity) * 100;
      
      const embed = new EmbedBuilder()
        .setTitle('🏥 Hospital Scan Report')
        .addFields(
          { name: 'Wounded Troops', value: aiData.wounded.toLocaleString(), inline: true },
          { name: 'Total Capacity', value: aiData.capacity.toLocaleString(), inline: true },
          { name: 'Fill Percentage', value: `${percentage.toFixed(1)}%`, inline: true }
        )
        .setTimestamp();

      if (percentage > 80) {
        embed.setColor('#FF0000');
        embed.setDescription('⚠️ **DANGER:** Your hospital is critically full. Heal immediately to prevent troop death!');
        
        // Ping the user directly with the high-priority warning
        await interaction.editReply({ content: `<@${interaction.user.id}> 🚨 **CRITICAL ALERT**`, embeds: [embed] });
      } else {
        embed.setColor('#00FF00');
        embed.setDescription('✅ Your hospital is at a safe capacity level.');
        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      if (error.message === 'DUPLICATE_IMAGE_FRAUD') {
        return interaction.editReply('❌ **Fraud Detected:** This screenshot has already been processed.');
      }
      logger.error(error, 'Error in Vision AI processing');
      await interaction.editReply('❌ Failed to process the image. The AI service may be unavailable.');
    }
  }
};
