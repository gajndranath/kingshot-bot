const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban-player')
    .setDescription('Permanently ban a player using their In-Game ID.')
    .addStringOption(option => 
      option.setName('in_game_id')
        .setDescription('The permanent In-Game ID of the player to ban')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the ban (e.g. Spying, Toxicity)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), // Require Discord Admin privileges as baseline

  async execute(interaction, client) {
    const inGameId = interaction.options.getString('in_game_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';
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

      // 2. Check if already banned
      const existingBan = await client.prisma.bannedPlayer.findUnique({
        where: { guild_id_in_game_id: { guild_id: guildId, in_game_id: inGameId } }
      });

      if (existingBan) {
        return interaction.editReply({ content: `⚠️ This ID (${inGameId}) is already banned by <@${existingBan.banned_by}>.` });
      }

      // 3. Find if they are currently registered in our DB
      const targetMember = await client.prisma.member.findFirst({
        where: { guild_id: guildId, in_game_id: inGameId }
      });

      let targetDiscordId = null;
      let targetInGameName = 'Unknown';

      if (targetMember) {
        targetDiscordId = targetMember.discord_id;
        targetInGameName = targetMember.in_game_name;
        // Delete them from Member table so they lose all access
        await client.prisma.member.delete({
          where: { id: targetMember.id }
        });
      }

      // 4. Add to BannedPlayer table
      await client.prisma.bannedPlayer.create({
        data: {
          guild_id: guildId,
          in_game_id: inGameId,
          banned_by: interaction.user.id,
          reason: reason
        }
      });

      // 5. Try to strip roles from the Discord User if they are still in the server
      if (targetDiscordId) {
        try {
          const discordMember = await interaction.guild.members.fetch(targetDiscordId);
          if (discordMember) {
            // Strip roles
            const roleMapping = [
              process.env.ROLE_MEMBER_ID,
              process.env.ROLE_R4_ID,
              process.env.ROLE_R5_ID
            ].filter(Boolean);

            if (roleMapping.length > 0) {
              await discordMember.roles.remove(roleMapping);
            }
            
            // Optionally, DM them
            await discordMember.send(`🚫 You have been **permanently banned** from the Alliance Hub in ${interaction.guild.name}. Reason: ${reason}`).catch(() => null);
          }
        } catch (err) {
          logger.warn(`Could not fetch discord member ${targetDiscordId} to strip roles. They might have left the server.`);
        }
      }

      // 6. Alert the audit channel
      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
      if (config && config.audit_channel) {
        const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
        if (auditChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🔨 PERMANENT BAN ISSUED')
            .setColor('#000000')
            .addFields(
              { name: 'Target In-Game ID', value: inGameId, inline: true },
              { name: 'Last Known Name', value: targetInGameName, inline: true },
              { name: 'Banned By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Reason', value: reason, inline: false }
            )
            .setTimestamp();
          
          await auditChannel.send({ embeds: [embed] });
        }
      }

      return interaction.editReply({ content: `✅ Successfully blacklisted **ID: ${inGameId}** from the server.` });

    } catch (error) {
      logger.error(error, 'Ban Player Error');
      return interaction.editReply({ content: '❌ An error occurred while trying to ban this player.' });
    }
  }
};
