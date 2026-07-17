const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('publish-guide')
    .setDescription('Publish the complete Kingshot Bot User Manual to the current channel (R4/R5 only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, client) {
    const guildId = interaction.guildId;

    try {
      // Security Check
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4 or R5 officials can publish the guide.', ephemeral: true });
      }

      await interaction.reply({ content: '✅ Publishing the Kingshot OS Master Guide to this channel...', ephemeral: true });

      // Embed 1: Introduction & General Commands
      const introEmbed = new EmbedBuilder()
        .setTitle('👑 KINGSHOT OS: COMPLETE MASTER GUIDE')
        .setDescription('Welcome to the most advanced Alliance Bot for Kingshot. This guide covers every single feature.\n\n**1️⃣ Member Basics:**\n- `/register`: Link your Discord to your In-Game ID. REQUIRED to use the bot.\n- `/leaderboard`: View the top 10 most active members.\n- `Right-Click -> Apps -> Translate`: Auto-translates any message to your app language.')
        .setColor('#FFD700')
        .setImage('https://i.imgur.com/8Q5Y2zL.png')
        .setFooter({ text: 'Part 1: General Commands' });

      // Embed 2: R4/R5 Management & Setup
      const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ R4 & R5 MANAGEMENT SUITE')
        .setColor('#E74C3C')
        .addFields(
          { name: 'Setup Commands', value: '- `/setup`: Initial bot config (channels, kingdom mode).\n- `/checkinsetup`: Setup the daily check-in button.\n- `/weekendwarrior`: Enable the casual player role.\n- `/filter`: Setup strategy/event channel filters.' },
          { name: 'Alliance Tools', value: '- `/controlpanel`: Admin UI dashboard.\n- `/announce`: Post official gold-colored announcements.\n- `/schedule`: Schedule events with local timezones.\n- `/vote`: Create Alliance petitions (Yes/No polls).' },
          { name: 'Role Management', value: '- `/promote @user [R4/R5]`: Give a member R4/R5 powers.\n- `/demote @user`: Strip an R4 of their powers.' }
        );

      // Embed 3: Kingdom & Diplomacy
      const kingdomEmbed = new EmbedBuilder()
        .setTitle('🛡️ KINGDOM & DIPLOMACY SCANNERS')
        .setColor('#3498DB')
        .addFields(
          { name: 'NAP Management', value: '- `/nap add [tag]`: Add an alliance to NAP.\n- `/nap remove [tag]`: Remove from NAP.\n- `/nap list`: View all protected alliances.' },
          { name: 'AI Image Scanners', value: '- `/reporthit`: Upload battle screenshot. AI checks for NAP violations.\n- `/reportdonation`: Upload tech leaderboard. AI extracts donation points.' },
          { name: 'Kingdom Health', value: '- `/server-health`: Analyzes the total active players and alliances in your State/Kingdom (Global tracking).' }
        );

      // Embed 4: Security & Premium AI
      const secEmbed = new EmbedBuilder()
        .setTitle('🤖 SECURITY & PREMIUM AI TOOLS')
        .setColor('#2ECC71')
        .addFields(
          { name: 'Ban System (Permanent ID)', value: '- `/ban-player [ID]`: Permanently blacklist a player\'s ID.\n- `/unban-player [ID]`: Remove a player from the blacklist.' },
          { name: 'Premium AI Tools', value: '- `/advisor`: Ask game strategy questions.\n- `/analyzer`: AI analyzes battle reports.\n- `/hospital`: Calculate troop healing times.\n- `/kvk`: AI generates KvK strategy.' },
          { name: 'Premium Subscriptions', value: 'Want to upgrade your alliance? Run `/premium` (Coming Soon) to unlock unlimited AI tokens!' }
        )
        .setFooter({ text: 'Powered by Kingshot OS' });

      // Send all embeds into the channel
      await interaction.channel.send({ embeds: [introEmbed, adminEmbed, kingdomEmbed, secEmbed] });

    } catch (error) {
      logger.error(error, 'Publish Guide Error');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Failed to publish guide.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Failed to publish guide.', ephemeral: true });
      }
    }
  }
};
