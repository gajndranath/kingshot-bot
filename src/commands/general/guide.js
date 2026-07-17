const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Post Alliance Event Strategy Guides via Interactive Dashboard (R4/R5 only)')
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
        .setTitle('📚 Guide Poster Dashboard')
        .setDescription('Welcome to the Guide Poster.\n\n1️⃣ Select a **Target Channel** (Optional - Uses Default).\n2️⃣ Select a **Strategy Guide**.\n3️⃣ Click **Proceed** to post the guide.')
        .setColor('#3498db');

      const channelMenu = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('ui_guide_channel')
          .setPlaceholder('1️⃣ Target Channel (Optional - Uses Default)')
          .setChannelTypes(ChannelType.GuildText)
      );

      const templateMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ui_guide_template')
          .setPlaceholder('2️⃣ Select a Strategy Guide')
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('🐻 Bear Hunt').setValue('guide_bear_hunt').setDescription('Strategy for Bear Trap'),
            new StringSelectMenuOptionBuilder().setLabel('🏰 Castle Siege').setValue('guide_castle_siege').setDescription('Strategy for Sunfire Castle'),
            new StringSelectMenuOptionBuilder().setLabel('⚔️ KvK (SVS)').setValue('guide_kvk').setDescription('State vs State Warfare Rules'),
            new StringSelectMenuOptionBuilder().setLabel('🛡️ Facility/Fortress').setValue('guide_facility').setDescription('Facility capture strategy')
          )
      );

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('post_guide_btn')
          .setLabel('3️⃣ Proceed to Post Guide')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [embed], components: [channelMenu, templateMenu, buttonRow], flags: 64 });

    } catch (error) {
      logger.error(error, 'Guide Command Error');
      await interaction.reply({ content: '❌ Failed to load guide dashboard.', flags: 64 });
    }
  }
};
