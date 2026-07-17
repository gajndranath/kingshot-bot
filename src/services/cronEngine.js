const cron = require('node-cron');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const { scrapePatchNotes, scrapeGiftCodes, generateEventGuide } = require('./scraper');

/**
 * Initializes the Cron Engine for all scheduled tasks.
 * @param {import('discord.js').Client} client 
 */
function initCronEngine(client) {
  logger.info('⏳ Initializing A-to-Z Advanced Cron Engine...');

  // 1. Daily Morning Summary & Kingdom Age increment (06:00 AM)
  cron.schedule('0 6 * * *', async () => {
    logger.info('Running Daily Kingdom Age & Summary Job');
    try {
      const guilds = await client.prisma.guildConfig.findMany();
      
      for (const config of guilds) {
        if (!config.alert_channel) continue;

        // Increment Kingdom Age
        const newAge = (config.kingdom_age || 0) + 1;
        await client.prisma.guildConfig.update({
          where: { guild_id: config.guild_id },
          data: { kingdom_age: newAge }
        });

        const channel = await client.channels.fetch(config.alert_channel).catch(() => null);
        if (!channel) continue;

        // Calculate rotation (4-week cycle)
        const rotationWeek = Math.floor(newAge / 7) % 4;
        let weekEvent = 'Preparation Week';
        if (rotationWeek === 1) weekEvent = 'Castle Siege';
        else if (rotationWeek === 2) weekEvent = 'State vs State (SvS)';
        else if (rotationWeek === 3) weekEvent = 'Recovery Week';

        const embed = new EmbedBuilder()
          .setTitle(`🌅 Daily Kingshot Summary`)
          .setDescription(`Kingdom is now **${newAge} days** old.`)
          .addFields(
            { name: 'Current Cycle', value: weekEvent, inline: true },
            { name: 'Fixed Events Today', value: 'Bear Hunt day! Make sure to set your formations.' }
          )
          .setColor('#0099ff')
          .setFooter({ text: '💡 Tip: Save your speedups—KvK prep starts in 4 days.' })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.error(error, 'Error in Daily Cron Job');
    }
  });

  // 2. Forum Scraper & Gift Codes (Every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running Forum Scraper...');
    const patch = await scrapePatchNotes();
    const codes = await scrapeGiftCodes();
    const guilds = await client.prisma.guildConfig.findMany({ where: { mode: 'SOLO' } });
    
    for (const g of guilds) {
      if (!g.gift_codes_channel) continue;
      const channel = await client.channels.fetch(g.gift_codes_channel).catch(() => null);
      if (channel) {
        if (patch.found) await channel.send(patch.summary);
        if (codes.found) await channel.send(codes.content);
      }
    }
  });

  // 3. Auto-Event Guides (Run before major events, mocked daily at 14:00)
  cron.schedule('0 14 * * *', async () => {
    const guide = await generateEventGuide('Bear Hunt');
    const guilds = await client.prisma.guildConfig.findMany({ where: { mode: 'SOLO' } });
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_ai_message')
        .setLabel('✏️ Edit (R4+)')
        .setStyle(ButtonStyle.Secondary)
    );

    for (const g of guilds) {
      if (!g.strategy_channel) continue;
      const channel = await client.channels.fetch(g.strategy_channel).catch(() => null);
      if (channel) {
        await channel.send({ content: guide, components: [row] });
      }
    }
  });

  // 4. Inactive Nudges & Decay (Every Sunday at 23:59)
  cron.schedule('59 23 * * 0', async () => {
    logger.info('Running Weekly Decay and Recap...');
    
    // Decay scores by 20%
    await client.prisma.$executeRaw`UPDATE "Member" SET activity_score = CAST(activity_score * 0.8 AS INTEGER) WHERE activity_score > 0`;

    // Send Weekly Recap
    const guilds = await client.prisma.guildConfig.findMany({ where: { mode: 'SOLO' } });
    for (const g of guilds) {
      if (!g.alert_channel) continue;
      const topMember = await client.prisma.member.findFirst({
        where: { guild_id: g.guild_id },
        orderBy: { activity_score: 'desc' }
      });
      const channel = await client.channels.fetch(g.alert_channel).catch(() => null);
      if (channel && topMember) {
        await channel.send(`🏆 **Weekly Recap:**\n- **MVP of the Week:** <@${topMember.discord_id}> with ${topMember.activity_score} Activity Points!\n- Great job everyone. Scores have been decayed by 20% for the new week.`);
      }

      // Auto-Nudge inactive members (3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const ghosts = await client.prisma.member.findMany({
        where: { guild_id: g.guild_id, last_active: { lt: threeDaysAgo } }
      });
      for (const ghost of ghosts) {
        const user = await client.users.fetch(ghost.discord_id).catch(() => null);
        if (user) {
          await user.send('👋 Hey! We noticed you haven\'t been active in the alliance lately. Make sure to tap ✅ on the next rally to stay off the kick list!').catch(() => {});
        }
      }

      // Auto-Demote inactive members (14 days & 0 score)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const deadGhosts = await client.prisma.member.findMany({
        where: { 
          guild_id: g.guild_id, 
          last_active: { lt: fourteenDaysAgo }, 
          activity_score: 0, 
          role: 'MEMBER',
          is_weekend_warrior: false
        }
      });

      for (const dead of deadGhosts) {
        const guildObj = await client.guilds.fetch(g.guild_id).catch(() => null);
        if (guildObj) {
          const discordMember = await guildObj.members.fetch(dead.discord_id).catch(() => null);
          if (discordMember && process.env.ROLE_MEMBER_ID) {
            await discordMember.roles.remove(process.env.ROLE_MEMBER_ID).catch(() => {});
            
            // Log to Audit
            if (g.audit_channel) {
              const auditChannel = await guildObj.channels.fetch(g.audit_channel).catch(() => null);
              if (auditChannel) {
                await auditChannel.send(`🚨 **Auto-Demotion:** <@${dead.discord_id}> has been inactive for 14 days with 0 score. Their Member role was removed.`);
              }
            }
          }
        }
      }
    }
  });

  // 5. NAP Expiry Checker (Runs every day at 12:00 PM) - Kingdom Mode
  cron.schedule('0 12 * * *', async () => {
    logger.info('Running NAP Expiry Checker');
    try {
      const now = new Date();
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const expiringNAPs = await client.prisma.nAP.findMany({
        where: {
          expires_at: {
            lte: in48Hours,
            gt: now
          }
        },
        include: { guild: true }
      });

      for (const nap of expiringNAPs) {
        if (!nap.guild || !nap.guild.alert_channel) continue;
        const channel = await client.channels.fetch(nap.guild.alert_channel).catch(() => null);
        if (!channel) continue;

        const timeRemaining = Math.floor((nap.expires_at - now) / (1000 * 60 * 60)); // in hours

        const embed = new EmbedBuilder()
          .setTitle('⚠️ NAP Expiring Soon')
          .setDescription(`The NAP with **${nap.target_alliance}** will expire in approximately **${timeRemaining} hours**.\n\n*Please discuss renewal or prepare for potential conflict.*`)
          .setColor('#FFA500')
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      // Cleanup expired NAPs
      await client.prisma.nAP.deleteMany({
        where: { expires_at: { lte: now } }
      });
    } catch (error) {
      logger.error(error, 'Error in NAP Expiry Cron Job');
    }
  });

  // 6. Scheduled Event Reminders (Runs every minute)
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Look for events happening in the next 15 minutes that haven't had a reminder sent
      const upcomingEventTime = new Date(now.getTime() + 15 * 60 * 1000);

      const events = await client.prisma.event.findMany({
        where: {
          reminder_sent: false,
          scheduled_time: {
            lte: upcomingEventTime,
            gt: now
          }
        },
        include: { rsvps: true }
      });

      for (const event of events) {
        // Find channel
        const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: event.guild_id } });
        const channelId = event.channel_id || config?.events_channel || config?.alert_channel;
        
        if (channelId) {
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (channel) {
            // Mention everyone who RSVP'd
            const rsvpMentions = event.rsvps.map(r => `<@${r.discord_id}>`).join(' ');
            
            const embed = new EmbedBuilder()
              .setTitle(`⏰ Event Reminder: ${event.name}`)
              .setDescription(`${event.description || 'Our event is starting in less than 15 minutes!'}\n\nGet ready and hop online!`)
              .setColor('#ff0000')
              .setTimestamp();

            await channel.send({ 
              content: rsvpMentions ? `**Attention RSVP'd Members:** ${rsvpMentions}` : '@everyone', 
              embeds: [embed] 
            });
          }
        }

        // Mark reminder as sent
        await client.prisma.event.update({
          where: { id: event.id },
          data: { reminder_sent: true }
        });
      }
    } catch (error) {
      logger.error(error, 'Error in Event Reminder Cron Job');
    }
  });
}

/**
 * Helper function to trigger a manual Rally/Event with Join buttons
 */
async function sendRallyAlert(client, guildId, eventName, maxPlayers = 30) {
  try {
    const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: guildId } });
    if (!config || !config.alert_channel) return;

    const channel = await client.channels.fetch(config.alert_channel).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${eventName} Rally Started!`)
      .setDescription(`A new rally has been called. Click below to join.\n\n**Joiners (0/${maxPlayers}):**\n*None yet*`)
      .setColor('#ff0000')
      .setFooter({ text: `max:${maxPlayers}` })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`join_rally_${eventName.replace(/\s+/g, '')}`)
          .setLabel('Join ✅')
          .setStyle(ButtonStyle.Success)
      );

    await channel.send({ content: '@everyone', embeds: [embed], components: [row] }); 
  } catch (error) {
    logger.error(error, 'Error sending rally alert');
  }
}

module.exports = {
  initCronEngine,
  sendRallyAlert
};
