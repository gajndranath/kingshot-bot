const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forceregister')
    .setDescription('Manually register a member (R4/R5 only).')
    .addUserOption(option => option.setName('user').setDescription('The Discord User to register').setRequired(true))
    .addStringOption(option => option.setName('in_game_name').setDescription('Exact In-Game Name').setRequired(true))
    .addStringOption(option => 
      option.setName('role')
        .setDescription('Role in alliance')
        .setRequired(true)
        .addChoices(
          { name: 'Member', value: 'MEMBER' },
          { name: 'R4', value: 'R4' },
          { name: 'R5', value: 'R5' }
        )
    )
    .addStringOption(option => option.setName('alliance_tag').setDescription('Alliance Tag (e.g., PHX)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const inGameName = interaction.options.getString('in_game_name');
    const roleInput = interaction.options.getString('role');
    let allianceTag = interaction.options.getString('alliance_tag');
    if (allianceTag) allianceTag = allianceTag.toUpperCase().substring(0, 5);
    const guildId = interaction.guildId;

    await interaction.deferReply({ flags: 64 });

    try {
      // 1. Security Check: Is the executor an R4/R5?
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });
      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.editReply('⛔ Only verified R4 or R5 officials can force register members.');
      }

      // 2. Upsert target user as VERIFIED
      await client.prisma.member.upsert({
        where: { discord_id_guild_id: { discord_id: targetUser.id, guild_id: guildId } },
        update: { in_game_name: inGameName, role: roleInput, alliance_tag: allianceTag, is_verified: true },
        create: { discord_id: targetUser.id, guild_id: guildId, in_game_name: inGameName, role: roleInput, alliance_tag: allianceTag, is_verified: true }
      });

      // 3. Apply Discord Role
      const discordMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (discordMember) {
        const roleMapping = {
          'MEMBER': process.env.ROLE_MEMBER_ID,
          'R4': process.env.ROLE_R4_ID,
          'R5': process.env.ROLE_R5_ID
        };

        const roleId = roleMapping[roleInput];
        if (roleId) {
          await discordMember.roles.add(roleId).catch(err => logger.warn(`Could not add role to ${targetUser.id}: ${err.message}`));
        }

        // 4. Change Nickname
        try {
          const nickname = allianceTag ? `[${allianceTag}] ${inGameName} - ${roleInput}` : `${inGameName} - ${roleInput}`;
          await discordMember.setNickname(nickname.substring(0, 32));
        } catch (err) {
          logger.warn(`Could not rename user ${targetUser.id}: ${err.message}`);
        }
      }

      // 5. Audit Log (Optional)
      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
      if (config && config.audit_channel) {
        const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
        if (auditChannel) {
          await auditChannel.send(`📝 **Audit Log:** R4/R5 <@${interaction.user.id}> manually registered and verified <@${targetUser.id}> as **${inGameName} (${roleInput})**.`);
        }
      }

      return interaction.editReply(`✅ Successfully registered and verified <@${targetUser.id}> as **${inGameName} (${roleInput})**.`);
    } catch (error) {
      logger.error(error, 'Force Register Error');
      return interaction.editReply('❌ An error occurred while force registering the member.');
    }
  }
};
