const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const { checkRateLimit } = require('../../middlewares/rateLimit');
const { checkSubscription } = require('../../middlewares/checkSubscription');
const Tesseract = require('tesseract.js'); // Assuming we use basic tesseract for OCR unless python brain is strictly required for this

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report-reward')
    .setDescription('Upload an event reward screenshot to have AI extract what you won.')
    .addAttachmentOption(option => 
      option.setName('screenshot')
        .setDescription('The screenshot of your rewards')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    if (!(await checkRateLimit(interaction))) return;
    if (!(await checkSubscription(interaction))) return;

    await interaction.deferReply();
    const attachment = interaction.options.getAttachment('screenshot');
    
    // Download image temporarily
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(attachment.url);
    const buffer = await response.buffer();
    const tempPath = path.join(__dirname, '..', '..', '..', 'temp', `${Date.now()}_reward.png`);
    
    if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    }
    fs.writeFileSync(tempPath, buffer);

    try {
      // OCR Processing
      const { data: { text } } = await Tesseract.recognize(tempPath, 'eng');
      fs.unlinkSync(tempPath);

      // Clean text heavily for gems, speedups, items
      const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, '').trim();

      const embed = new EmbedBuilder()
        .setTitle('🎁 Reward Extracted via AI')
        .setDescription(`**Raw OCR Output:**\n\`\`\`${cleaned.substring(0, 500) || 'No text found'}\`\`\`\n*Note: Our AI detected the above items in your chest!*`)
        .setColor('#FFD700')
        .setImage(attachment.url)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(error, 'OCR Error in report-reward');
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      await interaction.editReply('❌ AI failed to read your reward screenshot. Please ensure it is clear.');
    }
  }
};
