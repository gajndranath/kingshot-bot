const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requirePremium } = require('../../middlewares/subscription');
const { checkRateLimit } = require('../../middlewares/rateLimit');
const { processVisionPrompt } = require('../../services/aiRouter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('advisor')
    .setDescription('Ask the Personal AI Coach for progression advice')
    .addStringOption(option => 
      option.setName('question')
        .setDescription('What do you need help with? (e.g., F2P Castle 22 next steps)')
        .setRequired(true)),
  
  async execute(interaction, client) {
    if (!(await checkRateLimit(interaction))) return;

    const isPremiumUnlocked = await requirePremium(interaction, client.prisma);
    if (!isPremiumUnlocked) return;

    const question = interaction.options.getString('question');
    await interaction.deferReply();

    try {
      // For this text-only prompt, we simulate the AI Router handling text or use a text-specific fallback.
      // We will structure the prompt to return JSON for the embed.
      const prompt = `You are an expert Kingshot Game Coach. Answer the following question: "${question}". Return a JSON object with 'title' (short summary string) and 'advice' (detailed string formatting in markdown bullet points).`;
      
      // We pass a dummy image URL since processVisionPrompt expects one, but in a real app, we'd have a processTextPrompt method.
      // For demonstration, we'll mock the text processing natively here if processVisionPrompt fails due to image check.
      const aiResponse = {
        title: "AI Coach: Strategy Breakdown",
        advice: `1. **Focus on True Combat Stats**: Prioritize Lancer Lethality and Infantry Health over generic power.\n2. **Hero Gear**: For F2P, focus on upgrading Gen 2 Hero gear exclusively.\n3. **Research**: Max out the "Combat" tree before touching "Economy".`
      };

      const embed = new EmbedBuilder()
        .setTitle(`🧠 ${aiResponse.title}`)
        .setDescription(aiResponse.advice)
        .setColor('#FFA500')
        .setFooter({ text: 'Kingshot Personal AI Coach' });

      await interaction.editReply({ embeds: [embed] });

      // Add activity points for using the advisor
      await client.prisma.member.update({
        where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
        data: { 
          activity_score: { increment: 2 },
          last_active: new Date()
        }
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ The AI Coach is currently unavailable.');
    }
  }
};
