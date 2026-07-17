const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Create a new Alliance Poll (R4/R5 only)')
    .addStringOption(option => 
      option.setName('topic')
      .setDescription('The question you want to ask the alliance')
      .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('restriction')
      .setDescription('Who can vote?')
      .setRequired(true)
      .addChoices(
        { name: 'Everyone', value: 'ALL' },
        { name: 'R4 & R5 Only', value: 'R4' }
      )
    )
    .addIntegerOption(option => 
      option.setName('duration_hours')
      .setDescription('How many hours should this vote last?')
      .setRequired(true)
    ),
    
  async execute(interaction, client) {
    const topic = interaction.options.getString('topic');
    const restriction = interaction.options.getString('restriction');
    const hours = interaction.options.getInteger('duration_hours');
    const guildId = interaction.guildId;

    try {
      const member = await client.prisma.member.findUnique({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: guildId } }
      });

      if (!member || (member.role !== 'R4' && member.role !== 'R5')) {
        return interaction.reply({ content: '⛔ Only verified R4/R5 can create votes.', flags: 64 });
      }

      const closesAt = new Date();
      closesAt.setHours(closesAt.getHours() + hours);
      const unixCloses = Math.floor(closesAt.getTime() / 1000);

      // Create Vote in Database
      const voteRecord = await client.prisma.vote.create({
        data: {
          guild_id: guildId,
          topic: topic,
          restricted_to: restriction,
          closes_at: closesAt
        }
      });

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🗳️ Alliance Poll')
        .setDescription(`**Topic:** ${topic}\n\n**Closes:** <t:${unixCloses}:R>\n**Restriction:** ${restriction === 'ALL' ? 'Everyone' : 'R4 & R5 Only'}`)
        .addFields({ name: 'Current Tally', value: 'Yes: 0 | No: 0', inline: true })
        .setFooter({ text: 'Created by ' + interaction.user.tag });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vote_yes_${voteRecord.id}`)
          .setLabel('✅ Yes')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`vote_no_${voteRecord.id}`)
          .setLabel('❌ No')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ content: '@everyone A new vote has started!', embeds: [embed], components: [row] });

    } catch (error) {
      logger.error(error, 'Create Vote Error');
      await interaction.reply({ content: '❌ Failed to create vote.', flags: 64 });
    }
  },
};
