const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');
const { checkSubscription } = require('../../middlewares/checkSubscription');
const { checkMode } = require('../../middlewares/checkMode');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alliance-health')
    .setDescription('Scans the verified roster to generate an Alliance Health Report.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction, client) {
    if (!(await checkSubscription(interaction))) return;
    if (!(await checkMode(interaction, 'SOLO'))) return;

    await interaction.deferReply();

    try {
      const members = await client.prisma.member.findMany({
        where: { guild_id: interaction.guildId, is_verified: true }
      });

      if (members.length === 0) {
        return interaction.editReply('❌ No verified members found in this server.');
      }

      let activeCount = 0;
      let deadWeights = 0;
      let totalScore = 0;

      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      members.forEach(m => {
        totalScore += m.activity_score;
        if (m.activity_score > 10) {
          activeCount++;
        }
        if (m.activity_score === 0 && m.last_active < fourteenDaysAgo) {
          deadWeights++;
        }
      });

      const averageScore = Math.floor(totalScore / members.length);
      const activePercentage = (activeCount / members.length) * 100;

      let grade = 'F';
      let color = '#FF0000';
      if (activePercentage >= 80) { grade = 'A'; color = '#00FF00'; }
      else if (activePercentage >= 60) { grade = 'B'; color = '#0000FF'; }
      else if (activePercentage >= 40) { grade = 'C'; color = '#FFA500'; }

      const embed = new EmbedBuilder()
        .setTitle('🏥 Alliance Health Report')
        .setDescription(`**Overall Grade: ${grade}**`)
        .addFields(
          { name: 'Total Verified Members', value: `${members.length}`, inline: true },
          { name: 'Active Core', value: `${activeCount} members`, inline: true },
          { name: 'Average Activity Score', value: `${averageScore} points`, inline: true },
          { name: 'Dead Weights (14 Days Inactive)', value: `${deadWeights} members`, inline: false }
        )
        .setColor(color)
        .setFooter({ text: 'Kingshot OS Health Scanner' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(error, 'Error scanning health');
      await interaction.editReply('❌ Failed to generate health report.');
    }
  }
};
