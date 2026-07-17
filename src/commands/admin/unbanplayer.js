const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban-player')
    .setDescription('Remove a player from the permanent blacklist (Requires Alliance Vote Approval).')
    .addStringOption(option => 
      option.setName('in_game_id')
        .setDescription('The permanent In-Game ID of the player to unban')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    const inGameId = interaction.options.getString('in_game_id');
    const guildId = interaction.guildId;

    await interaction.deferReply({ flags: 64 });

    try {
      // 1. Verify clicker is an R4/R5
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.editReply({ content: '⛔ Only verified R4 or R5 officials can use this command.' });
      }

      // 2. Check if actually banned
      const existingBan = await client.prisma.bannedPlayer.findUnique({
        where: { guild_id_in_game_id: { guild_id: guildId, in_game_id: inGameId } }
      });

      if (!existingBan) {
        return interaction.editReply({ content: `⚠️ This ID (${inGameId}) is not currently on the ban list.` });
      }

      // 3. Remove from BannedPlayer table
      await client.prisma.bannedPlayer.delete({
        where: { guild_id_in_game_id: { guild_id: guildId, in_game_id: inGameId } }
      });

      // 4. Alert the audit channel
      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
      if (config && config.audit_channel) {
        const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
        if (auditChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🕊️ PERMANENT BAN LIFTED')
            .setColor('#00FF00')
            .addFields(
              { name: 'Target In-Game ID', value: inGameId, inline: true },
              { name: 'Unbanned By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Note', value: 'This should only be done after a successful Alliance /vote.', inline: false }
            )
            .setTimestamp();
          
          await auditChannel.send({ embeds: [embed] });
        }
      }

      return interaction.editReply({ content: `✅ Successfully removed **ID: ${inGameId}** from the ban list. They can now run /register again.` });

    } catch (error) {
      logger.error(error, 'Unban Player Error');
      return interaction.editReply({ content: '❌ An error occurred while trying to unban this player.' });
    }
  }
};
