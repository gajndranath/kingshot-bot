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
      await interaction.reply({ content: '✅ Publishing the Kingshot OS Master Guide to this channel...', ephemeral: true });

      // Embed 1: Introduction & General Commands
      const introEmbed = new EmbedBuilder()
        .setTitle('👑 KINGSHOT OS: COMPLETE MASTER GUIDE')
        .setDescription('Welcome to the most advanced Alliance Bot for Kingshot. This guide covers every single feature.\n\n**1️⃣ Member Basics:**\n- `/register`: Link your Discord to your In-Game Name. REQUIRED to use the bot.\n- `/leaderboard`: View the top 10 most active members.\n- `/botissue`: Report bugs or feedback directly to developers.\n- `Right-Click -> Apps -> Translate`: Auto-translates any message to your app language.')
        .setColor('#FFD700')
        .setImage('https://i.imgur.com/8Q5Y2zL.png')
        .setFooter({ text: 'Part 1: General Commands' });

      // Embed 2: R4/R5 Management & Setup
      const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ R4 & R5 MANAGEMENT SUITE')
        .setColor('#E74C3C')
        .addFields(
          { name: 'Setup Commands', value: '- `/setup`: Initial bot config (channels, kingdom mode).\n- `/publish-verify`: Spawns the self-verification button.\n- `/checkinsetup`: Setup the daily check-in button.\n- `/weekendwarrior`: Enable the casual player role.' },
          { name: 'Alliance Tools', value: '- `/control-panel`: Admin UI dashboard.\n- `/alliance-health`: Scan alliance for inactive dead weights (Solo Mode).\n- `/announce`: Post official gold-colored announcements.\n- `/vote`: Create Alliance petitions (Yes/No polls).' },
          { name: 'Role Management', value: '- `/promote @user [R4/R5]`: Give a member R4/R5 powers.\n- `/demote @user`: Strip an R4 of their powers.' }
        );

      // Embed 3: Kingdom & Diplomacy
      const kingdomEmbed = new EmbedBuilder()
        .setTitle('🛡️ KINGDOM & DIPLOMACY SCANNERS')
        .setColor('#3498DB')
        .addFields(
          { name: 'NAP Management', value: '- `/control-panel`: Click Manage NAP to add/remove alliances.' },
          { name: 'AI Image Scanners', value: '- `/reporthit`: Upload battle screenshot. AI checks for NAP violations.\n- `/reportdonation`: Upload tech leaderboard. AI extracts donation points.\n- `/report-reward`: AI scans your event rewards screenshot.' },
          { name: 'Global Health', value: '- `/global-stats`: Displays global bot metrics.' }
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
