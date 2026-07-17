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

      // Embed 2: Server Architecture
      const architectureEmbed = new EmbedBuilder()
        .setTitle('🏗️ RECOMMENDED CHANNEL ARCHITECTURE')
        .setColor('#9B59B6')
        .setDescription('To keep your server organized and the bot functioning perfectly, we recommend setting up these specific channels:')
        .addFields(
          { name: '🛂 #verification (Read-Only)', value: 'Use `/publish-verify` here. This is where new players will click the button to link their in-game name and get their roles.' },
          { name: '📢 #announcements (Read-Only)', value: 'Use `/announce` here to post official gold-bordered messages to everyone.' },
          { name: '📅 #events-feed', value: 'Use the `/control-panel` to schedule KvK or Bear Hunts, and the RSVP cards will go here.' },
          { name: '🤖 #bot-commands', value: 'A general spam channel where members should use `/report-reward`, `/reporthit`, and `/reportdonation`.' },
          { name: '🛡️ #nap-alerts (R4/R5 Only)', value: 'Set this as your diplomacy channel in `/setup`. Any NAP violations caught by the bot will be alerted here secretly.' },
          { name: '📝 #r4-audit-log (R4/R5 Only)', value: 'Set this as your audit channel in `/setup`. The bot logs all kicks, bans, and role changes here.' }
        );

      // Embed 3: R4/R5 Management & Setup
      const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ R4 & R5 MANAGEMENT SUITE')
        .setColor('#E74C3C')
        .addFields(
          { name: 'Setup Commands', value: '- `/setup`: Initial bot config (channels, kingdom mode).\n- `/publish-verify`: Spawns the self-verification button.\n- `/checkinsetup`: Setup the daily check-in button.\n- `/weekendwarrior`: Enable the casual player role.' },
          { name: 'Alliance Tools', value: '- `/control-panel`: Admin UI dashboard.\n- `/alliance-health`: Scan alliance for inactive dead weights (Solo Mode).\n- `/announce`: Post official gold-colored announcements.\n- `/vote`: Create Alliance petitions (Yes/No polls).\n- `/edit-event`: Modify an existing scheduled event.' },
          { name: 'Role Management', value: '- `/promote @user [R4/R5]`: Give a member R4/R5 powers.\n- `/demote @user`: Strip an R4 of their powers.\n- `/edit member`: R4 quick-edit console to fix roles.' }
        );

      // Embed 4: Kingdom & Diplomacy
      const kingdomEmbed = new EmbedBuilder()
        .setTitle('🛡️ KINGDOM & DIPLOMACY SCANNERS')
        .setColor('#3498DB')
        .addFields(
          { name: 'NAP Management', value: '- `/control-panel`: Click Manage NAP to add/remove alliances.' },
          { name: 'AI Image Scanners', value: '- `/reporthit`: Upload battle screenshot. AI checks for NAP violations.\n- `/reportdonation`: Upload tech leaderboard. AI extracts donation points.\n- `/report-reward`: AI scans your event rewards screenshot.' },
          { name: 'Global Health & Analytics', value: '- `/server-health`: Analyzes the total active players and alliances in your State/Kingdom.\n- `/global-stats`: Displays global bot metrics.\n- `/export`: Export Alliance Members or RSVPs to an Excel/CSV file (KvK ready).' }
        );

      // Embed 5: Security & Premium AI
      const secEmbed = new EmbedBuilder()
        .setTitle('🤖 SECURITY & PREMIUM AI TOOLS')
        .setColor('#2ECC71')
        .addFields(
          { name: 'Ban System (Permanent ID)', value: '- `/ban-player [ID]`: Permanently blacklist a player\'s ID.\n- `/unban-player [ID]`: Remove a player from the blacklist.' },
          { name: 'Premium AI Tools', value: '- `/advisor`: Ask game strategy questions.\n- `/analyzer`: AI analyzes battle reports.\n- `/hospital`: Calculate troop healing times.\n- `/kvk`: AI generates KvK strategy.' },
          { name: 'Premium Subscriptions', value: 'Want to upgrade your alliance? Use the Web Admin Panel to purchase unlimited AI tokens!' }
        )
        .setFooter({ text: 'Powered by Kingshot OS' });

      // Send all embeds into the channel
      await interaction.channel.send({ embeds: [introEmbed, architectureEmbed, adminEmbed, kingdomEmbed, secEmbed] });

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
