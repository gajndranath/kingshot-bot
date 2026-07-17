const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

function initCronJobs(client) {
  logger.info('[CRON] Initializing automated background jobs...');

  // 1. Auto-Reminder Cron Job
  // Runs every 1 minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Calculate time 15 minutes from now
      const in15Minutes = new Date(now.getTime() + 15 * 60000);
      
      // We look for events that are scheduled to happen BETWEEN now and 15 mins from now,
      // and where we haven't sent a reminder yet.
      const upcomingEvents = await client.prisma.event.findMany({
        where: {
          reminder_sent: false,
          scheduled_time: {
            lte: in15Minutes,
            gt: now // Still in the future
          }
        },
        include: {
          rsvps: true
        }
      });

      if (upcomingEvents.length > 0) {
        for (const event of upcomingEvents) {
          if (!event.channel_id) continue;

          try {
            const guild = await client.guilds.fetch(event.guild_id).catch(() => null);
            if (!guild) continue;
            const channel = await guild.channels.fetch(event.channel_id).catch(() => null);
            if (!channel) continue;

            const counts = { INFANTRY: 0, LANCER: 0, MARKSMAN: 0 };
            event.rsvps.forEach(rsvp => {
              if (counts[rsvp.troop_type] !== undefined) counts[rsvp.troop_type]++;
            });

            const unixTimestamp = Math.floor(event.scheduled_time.getTime() / 1000);
            const embed = new EmbedBuilder()
              .setColor('#E74C3C') // Red for urgency
              .setTitle(`🚨 EVENT STARTING SOON: ${event.name}`)
              .setDescription(`**Starting in less than 15 minutes!**\n**Time:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\n**RSVP Roster Summary:**\n🛡️ Infantry: ${counts.INFANTRY}\n🐎 Lancers: ${counts.LANCER}\n🏹 Marksmen: ${counts.MARKSMAN}\n\n*Please ensure your troops are ready and your buffs are activated!*`)
              .setThumbnail(guild.iconURL())
              .setFooter({ text: 'Kingshot Automated Reminder System' })
              .setTimestamp();

            await channel.send({ content: '@everyone 🚨 Event starting soon! Get online!', embeds: [embed] });
            await client.prisma.event.update({ where: { id: event.id }, data: { reminder_sent: true } });
            logger.info(`[CRON] Sent 15m reminder for event: ${event.name} in guild: ${guild.name}`);
          } catch (innerErr) {
            logger.error(innerErr, `[CRON] Error sending 15m reminder for event ${event.id}`);
          }
        }
      }

      // --- 5-MINUTE URGENT REMINDER LOOP ---
      const in5Minutes = new Date(now.getTime() + 5 * 60000);
      const urgentEvents = await client.prisma.event.findMany({
        where: {
          reminder_5m_sent: false,
          scheduled_time: { lte: in5Minutes, gt: now }
        }
      });

      if (urgentEvents.length > 0) {
        for (const event of urgentEvents) {
          if (!event.channel_id) continue;

          try {
            const guild = await client.guilds.fetch(event.guild_id).catch(() => null);
            if (!guild) continue;
            const channel = await guild.channels.fetch(event.channel_id).catch(() => null);
            if (!channel) continue;

            const unixTimestamp = Math.floor(event.scheduled_time.getTime() / 1000);
            const embed = new EmbedBuilder()
              .setColor('#FF0000') // Bright Red
              .setTitle(`🔥 EVENT STARTING NOW: ${event.name}`)
              .setDescription(`**The event starts in 5 minutes! (<t:${unixTimestamp}:R>)**\n\nIf you haven't logged in yet, do it now!`)
              .setFooter({ text: 'Urgent Final Ping' })
              .setTimestamp();

            await channel.send({ content: '@everyone 🔥 **FINAL CALL! 5 MINUTES LEFT!**', embeds: [embed] });
            await client.prisma.event.update({ where: { id: event.id }, data: { reminder_5m_sent: true } });
            logger.info(`[CRON] Sent 5m URGENT reminder for event: ${event.name} in guild: ${guild.name}`);
          } catch (innerErr) {
            logger.error(innerErr, `[CRON] Error sending 5m reminder for event ${event.id}`);
          }
        }
      }
    } catch (err) {
      logger.error(err, '[CRON] Auto-Reminder loop error');
    }
  });

  // 2. Auto-Cleanup Cron Job
  // Runs every day at Midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      // Events older than 24 hours
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const deleted = await client.prisma.event.deleteMany({
        where: {
          scheduled_time: {
            lt: yesterday
          }
        }
      });

      if (deleted.count > 0) {
        logger.info(`[CRON] Auto-Cleanup removed ${deleted.count} old events from the database.`);
      }
    } catch (err) {
      logger.error(err, '[CRON] Auto-Cleanup loop error');
    }
  });

  logger.info('[CRON] Automated background jobs started.');
}

module.exports = { initCronJobs };
