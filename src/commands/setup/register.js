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
      option.setName('in_game_id')
        .setDescription('Your permanent Kingshot account ID (e.g., 105829482)')
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
    const inGameId = interaction.options.getString('in_game_id');
    const role = interaction.options.getString('role');
    const allianceTag = interaction.options.getString('alliance_tag');

    await interaction.deferReply({ ephemeral: true });

    try {
      // Security Check: Is this ID Banned?
      const isBanned = await client.prisma.bannedPlayer.findUnique({
        where: { guild_id_in_game_id: { guild_id: interaction.guildId, in_game_id: inGameId } }
      });

      if (isBanned) {
        // Alert R4/R5 silently in their audit/alert channel
        const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: interaction.guildId } });
        if (config && config.alert_channel) {
          const alertChannel = await interaction.guild.channels.fetch(config.alert_channel).catch(() => null);
          if (alertChannel) {
            const embed = new EmbedBuilder()
              .setTitle('🚨 Banned Player Intrusion Attempt')
              .setDescription(`User <@${interaction.user.id}> attempted to register using a banned Game ID!`)
              .addFields(
                { name: 'Attempted Name', value: inGameName, inline: true },
                { name: 'Banned ID', value: inGameId, inline: true },
                { name: 'Ban Reason', value: isBanned.reason || 'No reason provided', inline: false }
              )
              .setColor('#FF0000');
            await alertChannel.send({ embeds: [embed] });
          }
        }
        return interaction.editReply({ content: '⛔ **Access Denied:** Your In-Game ID is permanently banned from this alliance.' });
      }

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
          in_game_id: inGameId,
          role: role,
          alliance_tag: allianceTag,
          is_verified: false
        },
        create: {
          discord_id: interaction.user.id,
          guild_id: interaction.guildId,
          in_game_name: inGameName,
          in_game_id: inGameId,
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

      // **SECURITY BYPASS 1: Server Owner Bootstrapping**
      const isOwner = interaction.user.id === interaction.guild.ownerId;
      if (isOwner) {
        await client.prisma.member.update({
          where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
          data: { is_verified: true, role: 'R5' }
        });
        
        embed.setTitle('🛡️ New Registration Request (AUTO-APPROVED)')
             .setDescription(`User <@${interaction.user.id}> is the Server Owner and was automatically verified as R5.`);
        await alertChannel.send({ embeds: [embed] });
        return interaction.editReply(`👑 **Server Owner Recognized!** You have been automatically verified as **${inGameName} (R5)**.`);
      }

      // **SECURITY BYPASS 2: Auto-Migration for Existing Servers**
      // If the user already possesses an official alliance role in Discord, they were vetted by an R4 in the past.
      const discordMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (discordMember) {
        const hasOfficialRole = 
          discordMember.roles.cache.has(process.env.ROLE_MEMBER_ID) ||
          discordMember.roles.cache.has(process.env.ROLE_R4_ID) ||
          discordMember.roles.cache.has(process.env.ROLE_R5_ID);

        if (hasOfficialRole) {
          await client.prisma.member.update({
            where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
            data: { is_verified: true }
          });
          
          embed.setTitle('🛡️ New Registration Request (AUTO-MIGRATED)')
               .setDescription(`User <@${interaction.user.id}> already held an official Discord Role. Their In-Game ID has been securely logged and they are Auto-Verified.`);
          await alertChannel.send({ embeds: [embed] });
          return interaction.editReply(`✅ **Auto-Verification Successful!** Since you already have an Alliance role in this server, your In-Game ID has been securely linked without needing R4 approval.`);
        }
      }

      await alertChannel.send({ embeds: [embed], components: [row] });
      
      await interaction.editReply(`✅ Registration submitted for **${inGameName}** (${role}). Please wait for R4/R5 approval in the alert channel.`);

    } catch (error) {
      throw error;
    }
  }
};
