const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote an R4 or R5 back to a regular Member.')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('The discord user to demote')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guildId;

    await interaction.deferReply({ flags: 64 });

    try {
      // 1. Verify clicker is an R5 (or server owner)
      const isOwner = interaction.user.id === interaction.guild.ownerId;
      let admin = null;
      
      if (!isOwner) {
        admin = await client.prisma.member.findUnique({
          where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
        });

        // Demotions should ideally only be done by R5. 
        if (!admin || !admin.is_verified || admin.role !== 'R5') {
          return interaction.editReply({ content: '⛔ Only the R5 (Leader) can demote officials.' });
        }
      }

      // 2. Find target in DB
      const targetMember = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: targetUser.id, guild_id: guildId } }
      });

      if (!targetMember || !targetMember.is_verified) {
        return interaction.editReply({ content: '⛔ This user is not a verified member of the alliance.' });
      }

      if (targetMember.role === 'MEMBER') {
        return interaction.editReply({ content: `⚠️ This user is already a regular Member.` });
      }

      if (targetUser.id === interaction.guild.ownerId) {
        return interaction.editReply({ content: '⛔ You cannot demote the Discord Server Owner.' });
      }

      const oldRole = targetMember.role;

      // 3. Update DB
      await client.prisma.member.update({
        where: { id: targetMember.id },
        data: { role: 'MEMBER' }
      });

      // 4. Update Discord Roles & Nickname
      try {
        const discordMember = await interaction.guild.members.fetch(targetUser.id);
        if (discordMember) {
          // Remove admin roles
          const adminRoleIds = [process.env.ROLE_R4_ID, process.env.ROLE_R5_ID].filter(Boolean);
          if (adminRoleIds.length > 0) {
            await discordMember.roles.remove(adminRoleIds);
          }

          // Add Member role
          if (process.env.ROLE_MEMBER_ID) {
            await discordMember.roles.add(process.env.ROLE_MEMBER_ID);
          }

          // Update Nickname
          const tagStr = targetMember.alliance_tag ? `[${targetMember.alliance_tag}] ` : '';
          const newNickname = `${tagStr}${targetMember.in_game_name} - MEMBER`;
          const safeNickname = newNickname.substring(0, 32);
          
          await discordMember.setNickname(safeNickname).catch(e => logger.warn('Could not set nickname during demote.'));
        }
      } catch (err) {
        logger.warn(`Failed to update discord roles/nickname for ${targetUser.id} during demote.`);
      }

      // 5. Alert Audit Channel
      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
      if (config && config.audit_channel) {
        const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
        if (auditChannel) {
          const embed = new EmbedBuilder()
            .setTitle('📉 ALLIANCE DEMOTION')
            .setColor('#E74C3C')
            .setDescription(`**${targetMember.in_game_name}** has been demoted from **${oldRole}** back to **MEMBER**.`)
            .addFields(
              { name: 'Demoted By', value: `<@${interaction.user.id}>` }
            )
            .setTimestamp();
          
          await auditChannel.send({ embeds: [embed] });
        }
      }

      // 6. Notify in chat
      await interaction.channel.send(`📉 <@${targetUser.id}> has been demoted to a regular **Member**.`);
      return interaction.editReply({ content: '✅ Demotion successful.' });

    } catch (error) {
      logger.error(error, 'Demote Error');
      return interaction.editReply({ content: '❌ An error occurred during demotion.' });
    }
  }
};
