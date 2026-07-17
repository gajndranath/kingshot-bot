const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an official Alliance Announcement via Pop-up Form (R4/R5 only)')
    .addStringOption(option => 
      option.setName('template')
        .setDescription('Optional: Choose a pre-written template')
        .addChoices(
          { name: '⚠️ Do Not Hit NAP', value: 'nap_reminder' },
          { name: '💪 Power Up Reminder', value: 'power_up' },
          { name: '🛡️ Train Troops', value: 'train_troops' },
          { name: '⚔️ Event Starting Soon', value: 'event_start' }
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, client) {
    try {
      const selectedTemplate = interaction.options.getString('template');

      const admin = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
      });

      if (!admin || !admin.is_verified || (admin.role !== 'R4' && admin.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4 or R5 officials can use this command.', flags: 64 });
      }

      // Define default texts
      let defaultTitle = '';
      let defaultMessage = '';

      if (selectedTemplate === 'nap_reminder') {
        defaultTitle = '⚠️ IMPORTANT: Do NOT hit NAP Alliances!';
        defaultMessage = 'Please double check alliance tags before attacking. Hitting alliances on our NAP (Non-Aggression Pact) safe list will result in strict punishment or expulsion. Check the #nap-list channel if you are unsure.';
      } else if (selectedTemplate === 'power_up') {
        defaultTitle = '💪 Power Up Reminder!';
        defaultMessage = 'Don\'t forget to use your speedups, train troops, upgrade your buildings, and complete your research. We need everyone at maximum power for upcoming events!';
      } else if (selectedTemplate === 'train_troops') {
        defaultTitle = '🛡️ Troop Training Order';
        defaultMessage = 'All members must prioritize training troops right now. Do not let your barracks sit idle. We need high tier troops for rallies and defense.';
      } else if (selectedTemplate === 'event_start') {
        defaultTitle = '⚔️ Event Starting Soon!';
        defaultMessage = 'Our scheduled event is starting soon! Please get online, use your buffs, and join the rallies. Follow instructions in the event channel.';
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_announce')
        .setTitle('📢 Create Announcement');

      const titleInput = new TextInputBuilder()
        .setCustomId('announce_title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. Alliance Rules Update')
        .setRequired(true);
      if (defaultTitle) titleInput.setValue(defaultTitle);

      const messageInput = new TextInputBuilder()
        .setCustomId('announce_message')
        .setLabel('Announcement Message')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type your official announcement here...')
        .setRequired(true);
      if (defaultMessage) messageInput.setValue(defaultMessage);

      const imageInput = new TextInputBuilder()
        .setCustomId('announce_image')
        .setLabel('Image URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://example.com/image.png')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(messageInput),
        new ActionRowBuilder().addComponents(imageInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      logger.error(error, 'Failed to show announce modal');
      await interaction.reply({ content: '❌ Could not open the announcement form.', flags: 64 });
    }
  }
};
