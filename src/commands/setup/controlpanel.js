const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('control-panel')
    .setDescription('Spawn the R4/R5 Master UI Control Panel in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
  async execute(interaction, client) {
    const guildId = interaction.guildId;

    try {
      // 1. Security Check
      const member = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });

      if (!member || (member.role !== 'R4' && member.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4/R5 can spawn the Control Panel.', flags: 64 });
      }

      // 2. Create the GUI Embed
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('👑 KINGSHOT MASTER CONTROL PANEL')
        .setDescription('Welcome to the Alliance Hub. Click the buttons below to manage the server without typing commands.\n\n📢 **Announce:** Post official announcements.\n📅 **Schedule Event:** Set up KvK, Bear Hunt, etc.\n📚 **Post Guide:** Post strategy guides.\n🛡️ **Manage NAP:** Add allies to the OCR safe list.')
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: 'Kingshot OS v2.0 - Authorized Personnel Only' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ui_open_announce')
          .setLabel('📢 Announce')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ui_schedule_event')
          .setLabel('📅 Schedule Event')
          .setStyle(ButtonStyle.Success)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ui_open_guide')
          .setLabel('📚 Post Guide')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ui_manage_nap')
          .setLabel('🛡️ Manage NAP')
          .setStyle(ButtonStyle.Danger)
      );

      // Send the persistent message
      await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
      
      // Reply ephemerally to close the command
      await interaction.reply({ content: '✅ Control Panel spawned successfully.', flags: 64 });

    } catch (error) {
      logger.error(error, 'Control Panel Spawner Error');
      await interaction.reply({ content: '❌ Failed to spawn Control Panel.', flags: 64 });
    }
  },
};
