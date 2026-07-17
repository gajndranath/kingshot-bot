const { SlashCommandBuilder } = require('discord.js');
const { requireR4 } = require('../../middlewares/auth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit')
    .setDescription('R4/R5 Quick-Edit Console')
    .addSubcommand(subcommand =>
      subcommand
        .setName('member')
        .setDescription('Edit a member\'s role')
        .addUserOption(option => option.setName('user').setDescription('The Discord User').setRequired(true))
        .addStringOption(option =>
          option.setName('role')
            .setDescription('New role')
            .setRequired(true)
            .addChoices(
              { name: 'Member', value: 'MEMBER' },
              { name: 'R4', value: 'R4' },
              { name: 'R5', value: 'R5' }
            )
        )
    ),
  
  async execute(interaction, client) {
    // RBAC Security Check
    const isAuthorized = await requireR4(interaction, client.prisma);
    if (!isAuthorized) return; // Middleware already replied with error

    const subCommand = interaction.options.getSubcommand();

    if (subCommand === 'member') {
      const targetUser = interaction.options.getUser('user');
      const newRole = interaction.options.getString('role');

      await interaction.deferReply({ flags: 64 });

      try {
        const updatedMember = await client.prisma.member.update({
          where: {
            discord_id_guild_id: {
              discord_id: targetUser.id,
              guild_id: interaction.guildId
            }
          },
          data: { role: newRole }
        });

        // Audit Logging Logic
        const config = await client.prisma.guildConfig.findUnique({
          where: { guild_id: interaction.guildId }
        });

        if (config && config.alert_channel) {
          const alertChannel = await interaction.guild.channels.fetch(config.alert_channel).catch(() => null);
          if (alertChannel) {
            await alertChannel.send(`📝 **Audit Log:** <@${interaction.user.id}> changed <@${targetUser.id}>'s role to **${newRole}**.`);
          }
        }

        await interaction.editReply(`✅ Successfully updated <@${targetUser.id}> to **${newRole}**.`);

      } catch (error) {
        if (error.code === 'P2025') {
          // Prisma error for record not found
          await interaction.editReply(`❌ User <@${targetUser.id}> is not registered in the database.`);
        } else {
          throw error;
        }
      }
    }
  }
};
