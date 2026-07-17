const { SlashCommandBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekend-warrior')
    .setDescription('Toggle your Weekend Warrior status (Protect yourself from auto-kicks if you work on weekdays).'),
    
  async execute(interaction, client) {
    const discordId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      const member = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: discordId, guild_id: guildId } }
      });

      if (!member) {
        return interaction.reply({ content: '❌ You must be registered first.', ephemeral: true });
      }

      const newStatus = !member.is_weekend_warrior;

      await client.prisma.member.update({
        where: { discord_id_guild_id: { discord_id: discordId, guild_id: guildId } },
        data: { is_weekend_warrior: newStatus }
      });

      if (newStatus) {
        await interaction.reply({ 
          content: '✅ You are now marked as a **Weekend Warrior**! You are protected from the 14-day inactivity auto-kick. We will see you on the weekends!',
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: '❌ You are no longer a Weekend Warrior. Regular activity rules apply.',
          ephemeral: true 
        });
      }

    } catch (error) {
      logger.error(error, 'Weekend Warrior toggle error');
      await interaction.reply({ content: 'An error occurred. Try again later.', ephemeral: true });
    }
  },
};
