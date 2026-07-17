const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('global_stats')
    .setDescription('Hidden Admin Command: View SaaS Metrics (Dev Only)'),
  
  async execute(interaction, client) {
    const DEVELOPER_DISCORD_ID = process.env.DEVELOPER_DISCORD_ID;

    if (!DEVELOPER_DISCORD_ID || interaction.user.id !== DEVELOPER_DISCORD_ID) {
      return interaction.reply({ content: '⛔ Unknown command or insufficient permissions.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const totalGuilds = await client.prisma.guildConfig.count();
      const totalMembers = await client.prisma.member.count();
      const premiumSubs = await client.prisma.subscription.count({
        where: { is_premium: true }
      });
      const activeTrials = await client.prisma.subscription.count({
        where: { is_premium: false, trial_expires: { gt: new Date() } }
      });

      // Calculate conceptual MRR (e.g., $15 per premium sub)
      const mrr = premiumSubs * 15;
      
      // Conceptual token consumption (Assume API tracks this in DB in reality)
      const tokenConsumption = (totalGuilds * 1500).toLocaleString(); 

      const embed = new EmbedBuilder()
        .setTitle('📈 Kingshot SaaS Metrics (Super Admin)')
        .addFields(
          { name: 'Total Servers', value: totalGuilds.toString(), inline: true },
          { name: 'Total Registered Players', value: totalMembers.toString(), inline: true },
          { name: '\u200b', value: '\u200b', inline: true }, // spacer
          { name: 'Active Premium', value: `⭐ ${premiumSubs}`, inline: true },
          { name: 'Active 7-Day Trials', value: `⏳ ${activeTrials}`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true }, // spacer
          { name: 'Monthly Recurring Rev (MRR)', value: `💰 $${mrr}`, inline: true },
          { name: 'AI Token Consumption', value: `🧠 ${tokenConsumption}`, inline: true }
        )
        .setColor('#800080')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Failed to fetch global stats.');
    }
  }
};
