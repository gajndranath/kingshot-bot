const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { requireR4 } = require('../../middlewares/auth');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Create a smart vote with pre-formatted templates.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('event')
        .setDescription('Ask who is available for an event today.')
        .addStringOption(option => option.setName('event_name').setDescription('e.g., Bear Hunt').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('time')
        .setDescription('Find the best time for coordination.')
        .addStringOption(option => option.setName('topic').setDescription('e.g., KvK Coordination').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick')
        .setDescription('Poll R4+ on removing a member.')
        .addUserOption(option => option.setName('member').setDescription('Member to kick').setRequired(true))
    ),
  
  async execute(interaction, client) {
    const isAuthorized = await requireR4(interaction, client.prisma);
    if (!isAuthorized) return;

    const subCommand = interaction.options.getSubcommand();
    await interaction.deferReply();

    try {
      let topic = '';
      let restrictedTo = 'MEMBER';
      let durationHours = 24;

      if (subCommand === 'event') {
        const eventName = interaction.options.getString('event_name');
        topic = `Who is available for ${eventName} today?`;
        durationHours = 1; // Short window
      } else if (subCommand === 'time') {
        const timeTopic = interaction.options.getString('topic');
        topic = `What is the best time for ${timeTopic}?`;
      } else if (subCommand === 'kick') {
        const targetUser = interaction.options.getUser('member');
        topic = `Should we kick ${targetUser.username} from the alliance?`;
        restrictedTo = 'R4'; // Leadership only
      }

      const closesAt = new Date();
      closesAt.setHours(closesAt.getHours() + durationHours);

      const voteRecord = await client.prisma.vote.create({
        data: {
          guild_id: interaction.guildId,
          topic: topic,
          restricted_to: restrictedTo,
          closes_at: closesAt
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('🗳️ New Alliance Poll')
        .setDescription(`**Topic:** ${topic}\n**Eligible Voters:** ${restrictedTo === 'R4' ? 'R4 & R5 Only' : 'All Verified Members'}\n\n*Click below to cast your vote anonymously.*`)
        .addFields(
          { name: 'Closes At', value: `<t:${Math.floor(closesAt.getTime() / 1000)}:R>`, inline: true },
          { name: 'Current Tally', value: 'Yes: 0 | No: 0', inline: true }
        )
        .setColor('#0099ff')
        .setFooter({ text: `VoteID: ${voteRecord.id}` });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_yes_${voteRecord.id}`)
            .setLabel('Vote Yes (🟢)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`vote_no_${voteRecord.id}`)
            .setLabel('Vote No (🔴)')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

      // Add points to the leader for organizing
      await client.prisma.member.update({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
        data: { activity_score: { increment: 2 }, last_active: new Date() }
      }).catch(() => {});

    } catch (error) {
      logger.error(error, 'Error creating vote');
      await interaction.editReply('❌ Failed to create the vote.');
    }
  }
};
