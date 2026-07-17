const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Initialize the Kingshot Bot for your server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option => 
      option.setName('kingdom_number')
        .setDescription('Your Kingdom Number')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('kingdom_age')
        .setDescription('Age of your Kingdom in days')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Select Bot Mode (Solo Alliance or Kingdom Server)')
        .setRequired(true)
        .addChoices(
          { name: 'Solo Alliance', value: 'SOLO' },
          { name: 'Kingdom Server', value: 'KINGDOM' }
        ))
    .addChannelOption(option =>
      option.setName('alert_channel')
        .setDescription('Channel for system alerts and reports')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)),
  
  /**
   * 
   * @param {import('discord.js').Interaction} interaction 
   * @param {import('discord.js').Client} client 
   */
  async execute(interaction, client) {
    const kingdomNumber = interaction.options.getInteger('kingdom_number');
    const kingdomAge = interaction.options.getInteger('kingdom_age');
    const mode = interaction.options.getString('mode');
    const alertChannel = interaction.options.getChannel('alert_channel');

    await interaction.deferReply({ flags: 64 });

    try {
      // Upsert GuildConfig in DB
      const config = await client.prisma.guildConfig.upsert({
        where: { guild_id: interaction.guildId },
        update: {
          kingdom_number: kingdomNumber,
          kingdom_age: kingdomAge,
          mode: mode,
          alert_channel: alertChannel.id,
        },
        create: {
          guild_id: interaction.guildId,
          kingdom_number: kingdomNumber,
          kingdom_age: kingdomAge,
          mode: mode,
          alert_channel: alertChannel.id,
        }
      });

      // Initialize 7-Day Trial Subscription lock
      const trialExpires = new Date();
      trialExpires.setDate(trialExpires.getDate() + 7);

      await client.prisma.subscription.upsert({
        where: { guild_id: interaction.guildId },
        update: {}, // Don't extend trial if they run setup again
        create: {
          guild_id: interaction.guildId,
          is_premium: false,
          trial_expires: trialExpires
        }
      });

      // Simple response embed for now
      await interaction.editReply({
        content: `✅ **Setup Complete!**\n- **Kingdom:** #${config.kingdom_number}\n- **Age:** ${config.kingdom_age} days\n- **Mode:** ${config.mode}\n- **Alerts:** <#${config.alert_channel}>\n\n*The Core Engine is now tracking your server.*`
      });
    } catch (error) {
      throw error; // Let the global interaction handler catch and log it
    }
  }
};
