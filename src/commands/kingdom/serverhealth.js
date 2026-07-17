const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-health')
    .setDescription('Analyzes the global activity of your current Kingdom (State).'),

  async execute(interaction, client) {
    await interaction.deferReply();

    try {
      // 1. Get the current kingdom number from this Guild's config
      const currentConfig = await client.prisma.guildConfig.findUnique({
        where: { guild_id: interaction.guildId }
      });

      if (!currentConfig || !currentConfig.kingdom_number) {
        return interaction.editReply({ content: '⛔ Your alliance has not set a Kingdom Number yet. Run `/setup` first to link your server to a State/Kingdom.' });
      }

      const kingdomNum = currentConfig.kingdom_number;

      // 2. Query all GuildConfigs (Alliances) in this kingdom
      const alliancesInKingdom = await client.prisma.guildConfig.findMany({
        where: { kingdom_number: kingdomNum }
      });

      const totalAlliances = alliancesInKingdom.length;
      const guildIdsInKingdom = alliancesInKingdom.map(g => g.guild_id);

      // 3. Query Active Players (Members who checked in or were active in the last 72 hours)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const activePlayersCount = await client.prisma.member.count({
        where: {
          guild_id: { in: guildIdsInKingdom },
          is_verified: true,
          last_active: { gte: threeDaysAgo }
        }
      });

      const totalPlayersCount = await client.prisma.member.count({
        where: { guild_id: { in: guildIdsInKingdom }, is_verified: true }
      });

      // 4. Calculate Health Metric
      let healthStatus = '🟢 THRIVING';
      let healthDesc = 'Your kingdom is highly active with healthy alliance competition.';

      if (totalAlliances === 1 && activePlayersCount < 20) {
        healthStatus = '🔴 DEAD STATE';
        healthDesc = 'Only one alliance is registered and activity is extremely low. Consider merging or migrating.';
      } else if (activePlayersCount < 50) {
        healthStatus = '🟡 DECLINING';
        healthDesc = 'Activity is low. The kingdom may be dying out. Push players to use the daily check-in!';
      }

      // 5. Build Report
      const embed = new EmbedBuilder()
        .setTitle(`🌐 KINGDOM #${kingdomNum} HEALTH REPORT`)
        .setDescription(`This report aggregates data across all alliances in Kingdom ${kingdomNum} that are using Kingshot OS.`)
        .setColor(healthStatus.includes('THRIVING') ? '#2ECC71' : (healthStatus.includes('DECLINING') ? '#F1C40F' : '#E74C3C'))
        .addFields(
          { name: 'Status', value: healthStatus, inline: false },
          { name: 'Analysis', value: healthDesc, inline: false },
          { name: 'Registered Alliances', value: `${totalAlliances}`, inline: true },
          { name: 'Total Tracked Players', value: `${totalPlayersCount}`, inline: true },
          { name: 'Active Players (72h)', value: `${activePlayersCount}`, inline: true }
        )
        .setFooter({ text: 'Data sourced from Kingshot OS Global Database' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error(error, 'Server Health Error');
      await interaction.editReply({ content: '❌ Failed to generate the Kingdom Health Report.' });
    }
  }
};
