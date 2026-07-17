const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the most active members in the alliance.'),

  async execute(interaction, client) {
    const guildId = interaction.guildId;

    await interaction.deferReply();

    try {
      // Fetch top 10 most active members
      const topMembers = await client.prisma.member.findMany({
        where: { guild_id: guildId, is_verified: true },
        orderBy: { activity_score: 'desc' },
        take: 10
      });

      if (topMembers.length === 0) {
        return interaction.editReply('No active verified members found in this alliance yet.');
      }

      // Build the leaderboard string
      let leaderboardText = '';
      const medals = ['🥇', '🥈', '🥉'];

      topMembers.forEach((member, index) => {
        const medal = index < 3 ? medals[index] : `**#${index + 1}**`;
        const roleStr = member.role !== 'MEMBER' ? `[${member.role}]` : '';
        const tagStr = member.alliance_tag ? `[${member.alliance_tag}] ` : '';
        
        leaderboardText += `${medal} ${tagStr}**${member.in_game_name}** ${roleStr} — **${member.activity_score}** Pts\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${interaction.guild.name} Leaderboard`)
        .setDescription(leaderboardText)
        .setColor('#FFD700')
        .setFooter({ text: 'Earn points by daily check-ins and tech donations!' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error(error, 'Leaderboard Error');
      await interaction.editReply({ content: '❌ Failed to fetch the leaderboard.' });
    }
  }
};
