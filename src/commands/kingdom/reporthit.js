const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report-hit')
    .setDescription('Scan a battle screenshot for NAP violations.')
    .addAttachmentOption(option => 
      option.setName('screenshot')
      .setDescription('The battle report screenshot')
      .setRequired(true)
    ),
    
  async execute(interaction, client) {
    const attachment = interaction.options.getAttachment('screenshot');
    const guildId = interaction.guildId;

    if (!attachment.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '❌ Please upload a valid image file.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      // 1. Fetch current NAP safe list for this kingdom
      const naps = await client.prisma.nAPAlliance.findMany({
        where: { guild_id: guildId, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] }
      });
      
      const safeTags = [];
      naps.forEach(n => {
        safeTags.push(n.tag);
        if (n.academy_tag) safeTags.push(n.academy_tag);
      });

      if (safeTags.length === 0) {
        return interaction.editReply({ content: 'ℹ️ There are no active NAP alliances registered for this kingdom.' });
      }

      // 2. Send image and tags to Python Brain
      const AI_BRAIN_URL = process.env.AI_BRAIN_URL || 'http://localhost:8000/api';
      const response = await fetch(`${AI_BRAIN_URL}/scan-nap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: attachment.url, safe_tags: safeTags })
      });

      if (!response.ok) {
        return interaction.editReply({ content: '❌ Failed to reach the AI OCR Engine.' });
      }

      const result = await response.json();

      if (result.status === 'error') {
        return interaction.editReply({ content: `❌ **Scan Error:** ${result.message}` });
      }

      if (result.status === 'clean') {
        return interaction.editReply({ content: '✅ **Scan Complete:** No protected NAP tags were found in this battle report.' });
      }

      if (result.status === 'violation') {
        const guildConfig = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
        
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('🚨 POTENTIAL NAP VIOLATION DETECTED')
          .setDescription(`The AI scanned this image and found the protected tag: **[${result.tag_found}]**`)
          .setImage(attachment.url)
          .setFooter({ text: 'Reported by ' + interaction.user.username });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_violation_${result.tag_found}`)
            .setLabel('Verify Strike')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`ignore_violation`)
            .setLabel('False Alarm (Ignore)')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ content: '🚨 **Warning Sent to R5/Diplomacy!**', embeds: [embed] });
        
        // Ping diplomacy channel if configured
        if (guildConfig && guildConfig.diplomacy_channel) {
          const dipChannel = await client.channels.fetch(guildConfig.diplomacy_channel).catch(() => null);
          if (dipChannel) {
            await dipChannel.send({ embeds: [embed], components: [row] });
          }
        }
      }

    } catch (error) {
      logger.error(error, 'Report Hit OCR Error');
      await interaction.editReply({ content: 'An error occurred during the OCR scan.' });
    }
  },
};
