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
        return interaction.reply({ content: '⛔ Only verified R4/R5 can spawn the Control Panel.', ephemeral: true });
      }

      // 2. Create the GUI Embed
      const embed = new EmbedBuilder()
        .setColor('#2b2d31') // Discord dark theme color
        .setTitle('👑 KINGSHOT MASTER CONTROL PANEL')
        .setDescription('Welcome to the Alliance Hub. Click the buttons below to manage the server without typing commands.\n\n📅 **Schedule Event:** Set up KvK, Bear Hunt, etc.\n🛡️ **Manage NAP:** Add allies to the OCR safe list.\n⚙️ **Settings:** (Coming Soon)')
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: 'Kingshot OS v2.0 - Authorized Personnel Only' });

      // 3. Create the Buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ui_schedule_event')
          .setLabel('📅 Schedule Event')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ui_manage_nap')
          .setLabel('🛡️ Manage NAP')
          .setStyle(ButtonStyle.Success)
      );

      // Send the persistent message
      await interaction.channel.send({ embeds: [embed], components: [row] });
      
      // Reply ephemerally to close the command
      await interaction.reply({ content: '✅ Control Panel spawned successfully.', ephemeral: true });

    } catch (error) {
      logger.error(error, 'Control Panel Spawner Error');
      await interaction.reply({ content: '❌ Failed to spawn Control Panel.', ephemeral: true });
    }
  },
};
