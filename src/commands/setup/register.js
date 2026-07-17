const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your in-game identity with the bot.')
    .addStringOption(option => 
      option.setName('in_game_name')
        .setDescription('Your exact Kingshot in-game name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('role')
        .setDescription('Your in-game role')
        .setRequired(true)
        .addChoices(
          { name: 'Member', value: 'MEMBER' },
          { name: 'R4', value: 'R4' },
          { name: 'R5', value: 'R5' }
        ))
    .addStringOption(option =>
      option.setName('alliance_tag')
        .setDescription('Your Alliance Tag')
        .setRequired(false)),
  
  async execute(interaction, client) {
    const inGameName = interaction.options.getString('in_game_name');
    const role = interaction.options.getString('role');
    const allianceTag = interaction.options.getString('alliance_tag');

    await interaction.deferReply({ ephemeral: true });

    try {
      // Upsert Member into DB as unverified
      const member = await client.prisma.member.upsert({
        where: {
          discord_id_guild_id: {
            discord_id: interaction.user.id,
            guild_id: interaction.guildId
          }
        },
        update: {
          in_game_name: inGameName,
          role: role,
          alliance_tag: allianceTag,
          is_verified: false
        },
        create: {
          discord_id: interaction.user.id,
          guild_id: interaction.guildId,
          in_game_name: inGameName,
          role: role,
          alliance_tag: allianceTag,
          is_verified: false
        }
      });

      // Get GuildConfig to find the alert channel
      const config = await client.prisma.guildConfig.findUnique({
        where: { guild_id: interaction.guildId }
      });

      if (!config || !config.alert_channel) {
        return interaction.editReply('Server is not setup correctly. Admin needs to run /setup first.');
      }

      const alertChannel = await interaction.guild.channels.fetch(config.alert_channel).catch(() => null);
      if (!alertChannel) {
        return interaction.editReply('Alert channel not found. Please contact an admin.');
      }

      // Build Embed for R4/R5
      const embed = new EmbedBuilder()
        .setTitle('🛡️ New Registration Request')
        .setDescription(`User <@${interaction.user.id}> has requested to register.`)
        .addFields(
          { name: 'In-Game Name', value: inGameName, inline: true },
          { name: 'Requested Role', value: role, inline: true }
        )
        .setColor('#FFA500')
        .setTimestamp();

      // Build Action Buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${interaction.user.id}_${interaction.guildId}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_${interaction.user.id}_${interaction.guildId}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
        );

      await alertChannel.send({ embeds: [embed], components: [row] });
      
      await interaction.editReply(`✅ Registration submitted for **${inGameName}** (${role}). Please wait for R4/R5 approval.`);

    } catch (error) {
      throw error;
    }
  }
};
