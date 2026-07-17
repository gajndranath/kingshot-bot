const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an official Alliance Announcement via Interactive Dashboard (R4/R5 only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, client) {
    try {
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4 or R5 officials can use this command.', flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setTitle('📢 Announcement Dashboard')
        .setDescription('Welcome to the Announcement Dashboard.\n\n1️⃣ Select a **Target Channel**.\n2️⃣ Select a **Template** (Optional).\n3️⃣ Click **Proceed** to edit and send the message.')
        .setColor('#2ecc71');

      const channelMenu = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('ui_announce_channel')
          .setPlaceholder('1️⃣ Target Channel (Optional - Uses Default)')
          .setChannelTypes(ChannelType.GuildText)
      );

      const templateMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ui_announce_template')
          .setPlaceholder('2️⃣ Select a Template (Optional)')
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('⚠️ Do Not Hit NAP').setValue('nap_reminder').setDescription('Warn members about NAP violations'),
            new StringSelectMenuOptionBuilder().setLabel('💪 Power Up Reminder').setValue('power_up').setDescription('Remind members to train/upgrade'),
            new StringSelectMenuOptionBuilder().setLabel('🛡️ Train Troops').setValue('train_troops').setDescription('Order members to train troops'),
            new StringSelectMenuOptionBuilder().setLabel('⚔️ Event Starting Soon').setValue('event_start').setDescription('Remind members about an upcoming event'),
            new StringSelectMenuOptionBuilder().setLabel('❌ None (Blank)').setValue('none').setDescription('Write your own message from scratch')
          )
      );

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_announce_modal')
          .setLabel('3️⃣ Proceed to Editor')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [embed], components: [channelMenu, templateMenu, buttonRow], flags: 64 });

    } catch (error) {
      logger.error(error, 'Failed to show announce dashboard');
      await interaction.reply({ content: '❌ Could not open the announcement dashboard.', flags: 64 });
    }
  }
};
