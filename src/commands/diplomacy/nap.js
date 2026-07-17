const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireR4 } = require('../../middlewares/auth');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nap')
    .setDescription('Manage Non-Aggression Pacts and Report Breaches')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new NAP with another alliance (R4/R5 only)')
        .addStringOption(option => 
          option.setName('target_alliance')
            .setDescription('Name or Tag of the enemy alliance')
            .setRequired(true))
        .addIntegerOption(option => 
          option.setName('duration_days')
            .setDescription('Duration of the NAP in days')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('breach')
        .setDescription('Report a NAP breach with evidence')
        .addAttachmentOption(option =>
          option.setName('evidence')
            .setDescription('Screenshot of the attack/scout')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Brief details of the breach')
            .setRequired(true))
    ),
  
  async execute(interaction, client) {
    const subCommand = interaction.options.getSubcommand();

    if (subCommand === 'create') {
      const isAuthorized = await requireR4(interaction, client.prisma);
      if (!isAuthorized) return; // Middleware handles the reply

      const targetAlliance = interaction.options.getString('target_alliance');
      const durationDays = interaction.options.getInteger('duration_days');

      await interaction.deferReply();

      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        await client.prisma.nAP.create({
          data: {
            guild_id: interaction.guildId,
            target_alliance: targetAlliance,
            expires_at: expiresAt
          }
        });

        const embed = new EmbedBuilder()
          .setTitle('🤝 New NAP Established')
          .setDescription(`A Non-Aggression Pact has been signed with **${targetAlliance}**.`)
          .addFields(
            { name: 'Duration', value: `${durationDays} Days`, inline: true },
            { name: 'Expires At', value: expiresAt.toDateString(), inline: true }
          )
          .setColor('#00FF00');

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        logger.error(error, 'Error creating NAP');
        await interaction.editReply('❌ Failed to create NAP.');
      }
    } else if (subCommand === 'breach') {
      // Any verified user can report a breach
      const member = await client.prisma.member.findUnique({
        where: {
          discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId }
        }
      });

      if (!member || !member.is_verified) {
        return interaction.reply({ content: '⛔ You must be verified to submit breach reports.', flags: 64 });
      }

      const evidence = interaction.options.getAttachment('evidence');
      const description = interaction.options.getString('description');

      await interaction.deferReply({ flags: 64 });

      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: interaction.guildId } });
      
      if (!config || !config.alert_channel) {
        return interaction.editReply('Alert channel not configured for leadership reports.');
      }

      const alertChannel = await interaction.guild.channels.fetch(config.alert_channel).catch(() => null);
      if (!alertChannel) return interaction.editReply('Alert channel not found.');

      const embed = new EmbedBuilder()
        .setTitle('🚨 NAP BREACH REPORTED')
        .setDescription(`**Reporter:** <@${interaction.user.id}>\n**Details:** ${description}`)
        .setImage(evidence.url)
        .setColor('#FF0000')
        .setTimestamp();

      await alertChannel.send({ embeds: [embed] });
      await interaction.editReply('✅ Breach report submitted to leadership successfully.');
    }
  }
};
