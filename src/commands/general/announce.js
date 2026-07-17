const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an official Alliance Announcement (R4/R5 only)')
    .addStringOption(option => 
      option.setName('title')
        .setDescription('The title of your announcement')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('message')
        .setDescription('The main text of your announcement')
        .setRequired(true))
    .addAttachmentOption(option => 
      option.setName('image')
        .setDescription('Optional image to attach')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, client) {
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');
    const guildId = interaction.guildId;

    try {
      // Security Check: Ensure clicker is R4/R5
      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4 or R5 officials can use this command.', flags: 64 });
      }

      // Build the Announcement Embed
      const embed = new EmbedBuilder()
        .setTitle(`📢 ${title}`)
        .setDescription(message)
        .setColor('#FFD700') // Gold color for announcements
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setFooter({ text: `Announced by ${admin.in_game_name} (${admin.role})` })
        .setTimestamp();

      if (image && image.contentType?.startsWith('image/')) {
        embed.setImage(image.url);
      }

      // Send the announcement
      await interaction.reply({ content: '@everyone', embeds: [embed] });

    } catch (error) {
      logger.error(error, 'Announcement Error');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Failed to send announcement.', flags: 64 });
      } else {
        await interaction.reply({ content: '❌ Failed to send announcement.', flags: 64 });
      }
    }
  }
};
