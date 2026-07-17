const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a member to an R4 or R5 role.')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('The discord user to promote')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('role')
        .setDescription('The new role to assign')
        .setRequired(true)
        .addChoices(
          { name: 'R4', value: 'R4' },
          { name: 'R5', value: 'R5' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const newRole = interaction.options.getString('role');
    const guildId = interaction.guildId;

    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. Verify clicker is an R4/R5 (or server owner)
      const isOwner = interaction.user.id === interaction.guild.ownerId;
      let admin = null;
      
      if (!isOwner) {
        admin = await client.prisma.member.findUnique({
          where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
        });

        // Only R5 (or owner) can promote someone to R5. R4s can only promote to R4 (if allowed at all).
        // Standard rule: R5 can do anything. R4 can only promote Members to R4.
        if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
          return interaction.editReply({ content: '⛔ Only verified R4 or R5 officials can use this command.' });
        }
        
        if (newRole === 'R5' && admin.role !== 'R5') {
          return interaction.editReply({ content: '⛔ Only an existing R5 or Server Owner can promote someone to R5.' });
        }
      }

      // 2. Find target in DB
      const targetMember = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: targetUser.id, guild_id: guildId } }
      });

      if (!targetMember || !targetMember.is_verified) {
        return interaction.editReply({ content: '⛔ This user is not a verified member of the alliance. They must /register first.' });
      }

      if (targetMember.role === newRole) {
        return interaction.editReply({ content: `⚠️ This user is already an ${newRole}.` });
      }

      // 3. Update DB
      await client.prisma.member.update({
        where: { id: targetMember.id },
        data: { role: newRole }
      });

      // 4. Update Discord Roles & Nickname
      try {
        const discordMember = await interaction.guild.members.fetch(targetUser.id);
        if (discordMember) {
          // Remove old roles
          const oldRoleIds = [process.env.ROLE_MEMBER_ID, process.env.ROLE_R4_ID, process.env.ROLE_R5_ID].filter(Boolean);
          if (oldRoleIds.length > 0) {
            await discordMember.roles.remove(oldRoleIds);
          }

          // Add new role
          const roleIdToAdd = newRole === 'R4' ? process.env.ROLE_R4_ID : process.env.ROLE_R5_ID;
          if (roleIdToAdd) {
            await discordMember.roles.add(roleIdToAdd);
          }

          // Update Nickname
          const tagStr = targetMember.alliance_tag ? `[${targetMember.alliance_tag}] ` : '';
          const newNickname = `${tagStr}${targetMember.in_game_name} - ${newRole}`;
          // Ensure it doesn't exceed Discord's 32 char limit
          const safeNickname = newNickname.substring(0, 32);
          
          // Only change nick if bot has permission and user is not owner
          if (targetUser.id !== interaction.guild.ownerId) {
            await discordMember.setNickname(safeNickname).catch(e => logger.warn('Could not set nickname during promote. Missing permissions.'));
          }
        }
      } catch (err) {
        logger.warn(`Failed to update discord roles/nickname for ${targetUser.id} during promote.`);
      }

      // 5. Alert Audit Channel
      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
      if (config && config.audit_channel) {
        const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
        if (auditChannel) {
          const embed = new EmbedBuilder()
            .setTitle('📈 ALLIANCE PROMOTION')
            .setColor('#2ECC71')
            .setDescription(`**${targetMember.in_game_name}** has been promoted to **${newRole}**!`)
            .addFields(
              { name: 'Promoted By', value: `<@${interaction.user.id}>` }
            )
            .setTimestamp();
          
          await auditChannel.send({ embeds: [embed] });
        }
      }

      // 6. Notify in chat
      await interaction.channel.send(`🎉 Congratulations <@${targetUser.id}>! You have been promoted to **${newRole}** in the alliance!`);
      return interaction.editReply({ content: '✅ Promotion successful.' });

    } catch (error) {
      logger.error(error, 'Promote Error');
      return interaction.editReply({ content: '❌ An error occurred during promotion.' });
    }
  }
};
