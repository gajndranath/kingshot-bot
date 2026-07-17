const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { requireR4 } = require('../../middlewares/auth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-filter')
    .setDescription('Configure advanced channel routing for the A-to-Z ecosystem')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option => 
      option.setName('events_channel')
        .setDescription('Channel for Event Calendars and Reminders')
        .addChannelTypes(ChannelType.GuildText))
    .addChannelOption(option => 
      option.setName('war_room_channel')
        .setDescription('Channel for KvK, Hospital Alerts, and Kill Leaderboards')
        .addChannelTypes(ChannelType.GuildText))
    .addChannelOption(option => 
      option.setName('bear_hunt_channel')
        .setDescription('Channel specifically for Bear Hunt rallies')
        .addChannelTypes(ChannelType.GuildText))
    .addChannelOption(option => 
      option.setName('gift_codes_channel')
        .setDescription('Channel for Auto-Scraped Gift Codes and Patch Notes')
        .addChannelTypes(ChannelType.GuildText))
    .addChannelOption(option => 
      option.setName('strategy_channel')
        .setDescription('Channel for AI Event Guides and Winning Strategies')
        .addChannelTypes(ChannelType.GuildText)),
  
  async execute(interaction, client) {
    const isAuthorized = await requireR4(interaction, client.prisma);
    if (!isAuthorized) return;

    const eventsChannel = interaction.options.getChannel('events_channel')?.id;
    const warRoomChannel = interaction.options.getChannel('war_room_channel')?.id;
    const bearHuntChannel = interaction.options.getChannel('bear_hunt_channel')?.id;
    const giftCodesChannel = interaction.options.getChannel('gift_codes_channel')?.id;
    const strategyChannel = interaction.options.getChannel('strategy_channel')?.id;

    await interaction.deferReply({ flags: 64 });

    try {
      const updateData = {};
      if (eventsChannel) updateData.events_channel = eventsChannel;
      if (warRoomChannel) updateData.war_room_channel = warRoomChannel;
      if (bearHuntChannel) updateData.bear_hunt_channel = bearHuntChannel;
      if (giftCodesChannel) updateData.gift_codes_channel = giftCodesChannel;
      if (strategyChannel) updateData.strategy_channel = strategyChannel;

      if (Object.keys(updateData).length === 0) {
        return interaction.editReply('❌ No channels were provided to update.');
      }

      await client.prisma.guildConfig.update({
        where: { guild_id: interaction.guildId },
        data: updateData
      });

      let summary = '✅ **Channel Routing Updated:**\n';
      if (eventsChannel) summary += `- **Events:** <#${eventsChannel}>\n`;
      if (warRoomChannel) summary += `- **War Room:** <#${warRoomChannel}>\n`;
      if (bearHuntChannel) summary += `- **Bear Hunt:** <#${bearHuntChannel}>\n`;
      if (giftCodesChannel) summary += `- **Gift Codes & News:** <#${giftCodesChannel}>\n`;
      if (strategyChannel) summary += `- **Strategy Guides:** <#${strategyChannel}>\n`;

      await interaction.editReply(summary);
    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Failed to update channel routing. Please ensure `/setup` was run first.');
    }
  }
};
