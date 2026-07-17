const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nap')
    .setDescription('Manage the Kingdom Non-Aggression Pact (NAP) safe list.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add an alliance to the NAP list (R4/R5 only)')
        .addStringOption(option => option.setName('tag').setDescription('Main Alliance Tag (e.g. K99)').setRequired(true))
        .addStringOption(option => option.setName('academy_tag').setDescription('Academy Alliance Tag (e.g. K99a)').setRequired(false))
        .addIntegerOption(option => option.setName('days').setDescription('Temporary NAP expiration in days').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove an alliance from the NAP list (R4/R5 only)')
        .addStringOption(option => option.setName('tag').setDescription('Main Alliance Tag (e.g. K99)').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View the current NAP protected alliances')
    ),
    
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    try {
      if (subcommand === 'add' || subcommand === 'remove') {
        const member = await client.prisma.member.findUnique({
          where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
        });
        if (!member || (member.role !== 'R4' && member.role !== 'R5')) {
          return interaction.reply({ content: '⛔ Only verified R4/R5 can manage the NAP list.', flags: 64 });
        }
      }

      if (subcommand === 'add') {
        const tag = interaction.options.getString('tag').toUpperCase().substring(0, 5);
        const academyTagInput = interaction.options.getString('academy_tag');
        const academyTag = academyTagInput ? academyTagInput.toUpperCase().substring(0, 5) : null;
        const days = interaction.options.getInteger('days');
        
        let expiresAt = null;
        if (days) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + days);
        }

        await client.prisma.nAPAlliance.upsert({
          where: { guild_id_tag: { guild_id: guildId, tag: tag } },
          update: { expires_at: expiresAt, added_by: interaction.user.id, academy_tag: academyTag },
          create: { guild_id: guildId, tag: tag, academy_tag: academyTag, added_by: interaction.user.id, expires_at: expiresAt }
        });

        await interaction.reply({ content: `✅ **[${tag}]** ${academyTag ? `(and Academy **[${academyTag}]**)` : ''} has been added to the NAP Safe List.${days ? ` (Expires in ${days} days)` : ''}` });
      }

      if (subcommand === 'remove') {
        const tag = interaction.options.getString('tag').toUpperCase().substring(0, 5);
        
        const existing = await client.prisma.nAPAlliance.findUnique({
          where: { guild_id_tag: { guild_id: guildId, tag: tag } }
        });

        if (!existing) return interaction.reply({ content: `❌ Tag **[${tag}]** is not on the NAP list.`, flags: 64 });

        await client.prisma.nAPAlliance.delete({
          where: { guild_id_tag: { guild_id: guildId, tag: tag } }
        });

        await interaction.reply({ content: `⚠️ **[${tag}]** ${existing.academy_tag ? `(and Academy **[${existing.academy_tag}]**)` : ''} has been removed from the NAP Safe List. They are now hostile.` });
      }

      if (subcommand === 'list') {
        const naps = await client.prisma.nAPAlliance.findMany({
          where: { guild_id: guildId }
        });

        if (naps.length === 0) {
          return interaction.reply({ content: 'No alliances are currently protected under NAP.', flags: 64 });
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('🛡️ Kingdom NAP Safe List')
          .setDescription(naps.map(n => {
            const exp = n.expires_at ? `(Expires <t:${Math.floor(n.expires_at.getTime() / 1000)}:R>)` : '(Permanent)';
            const aca = n.academy_tag ? `\n   ↳ *Academy:* **[${n.academy_tag}]**` : '';
            return `**[${n.tag}]** - Added by <@${n.added_by}> ${exp}${aca}`;
          }).join('\n\n'));

        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error(error, 'NAP Command Error');
      await interaction.reply({ content: 'An error occurred while managing NAP.', flags: 64 });
    }
  },
};
