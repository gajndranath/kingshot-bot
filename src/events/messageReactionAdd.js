const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Dictionary of supported country flags and their corresponding languages
const FLAG_LANGUAGES = {
  '🇺🇸': 'English',
  '🇬🇧': 'English',
  '🇪🇸': 'Spanish',
  '🇫🇷': 'French',
  '🇸🇦': 'Arabic',
  '🇧🇷': 'Portuguese',
  '🇵🇹': 'Portuguese',
  '🇮🇳': 'Hindi',
  '🇮🇩': 'Indonesian',
  '🇵🇭': 'Filipino',
  '🇷🇺': 'Russian',
  '🇩🇪': 'German',
  '🇮🇹': 'Italian',
  '🇯🇵': 'Japanese',
  '🇰🇷': 'Korean',
  '🇨🇳': 'Chinese (Simplified)',
  '🇹🇷': 'Turkish'
};

module.exports = {
  name: 'messageReactionAdd',
  /**
   * 
   * @param {import('discord.js').MessageReaction} reaction 
   * @param {import('discord.js').User} user 
   * @param {import('discord.js').Client} client 
   */
  async execute(reaction, user, client) {
    // Ignore bots reacting
    if (user.bot) return;

    // When a reaction is received, check if the structure is partial
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        logger.error(error, 'Something went wrong when fetching the message for reaction');
        return;
      }
    }

    const emojiName = reaction.emoji.name;
    const targetLanguage = FLAG_LANGUAGES[emojiName];

    // If it's not a supported flag, ignore it
    if (!targetLanguage) return;

    const message = reaction.message;

    // Ignore empty messages (e.g. only images)
    if (!message.content || message.content.trim() === '') return;

    try {
      // Basic anti-spam/duplicate check
      // Check if the bot has already replied to this message with a translation embed for this user
      // Or just check if the bot already reacted with the flag
      const botReaction = message.reactions.cache.find(r => r.emoji.name === emojiName && r.me);
      if (botReaction) {
        // We already processed this flag translation for this message, skip to avoid spam
        return;
      }

      // Add our own flag reaction to mark it as processed
      await message.react(emojiName).catch(() => null);
      
      // Call OpenAI for Translation
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Fast and cheap model for translation
        messages: [
          {
            role: "system",
            content: `You are an expert game translator for a strategy game. Translate the following text into ${targetLanguage}. Preserve all gaming slang, names, and emojis. Only return the translated text, nothing else.`
          },
          {
            role: "user",
            content: message.content
          }
        ],
        temperature: 0.3,
      });

      const translatedText = completion.choices[0].message.content.trim();

      // Send the translated embed as a direct reply to the original message
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setAuthor({ name: `${message.author.username} (Translated to ${targetLanguage})`, iconURL: message.author.displayAvatarURL() || undefined })
        .setDescription(translatedText)
        .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() || undefined });

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (error) {
      logger.error(error, `Failed to translate message to ${targetLanguage}`);
    }
  }
};
