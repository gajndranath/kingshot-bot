const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { requireR4 } = require('../../middlewares/auth');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('export_data')
    .setDescription('Export all alliance data to a CSV file (R5 Only)'),
  
  async execute(interaction, client) {
    const isAuthorized = await requireR4(interaction, client.prisma);
    if (!isAuthorized) return;
    
    // Additional restriction to R5 only
    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
    });

    if (member.role !== 'R5') {
      return interaction.reply({ content: '⛔ Only the R5 can export database records.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const members = await client.prisma.member.findMany({
        where: { guild_id: interaction.guildId },
        orderBy: { in_game_name: 'asc' }
      });

      if (members.length === 0) {
        return interaction.editReply('No members found in the database.');
      }

      // Build CSV String
      const headers = ['InGameName', 'DiscordID', 'Role', 'VerifiedStatus', 'JoinDate'];
      const rows = members.map(m => 
        [m.in_game_name, m.discord_id, m.role, m.is_verified, m.created_at.toISOString()].join(',')
      );
      const csvContent = [headers.join(','), ...rows].join('\n');

      // Create Discord Attachment from Buffer
      const buffer = Buffer.from(csvContent, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'kingshot_roster.csv' });

      // DM the R5
      try {
        await interaction.user.send({
          content: `📊 Here is the requested data export for **${interaction.guild.name}**:`,
          files: [attachment]
        });
        await interaction.editReply('✅ The data export has been sent to your DMs.');
      } catch (dmError) {
        // If DMs are closed
        await interaction.editReply({
          content: '⚠️ I could not send you a DM. Here is your file (ephemeral).',
          files: [attachment]
        });
      }

    } catch (error) {
      logger.error(error, 'Error exporting CSV data');
      await interaction.editReply('❌ Failed to generate the data export.');
    }
  }
};
