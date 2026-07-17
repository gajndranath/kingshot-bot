const logger = require('../utils/logger');
const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  /**
   * 
   * @param {import('discord.js').Interaction} interaction 
   * @param {import('discord.js').Client} client 
   */
  async execute(interaction, client) {
    if (interaction.isButton()) {
      return handleButtonInteraction(interaction, client);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_edit_ai') {
        const newText = interaction.fields.getTextInputValue('ai_text_input');
        const message = interaction.message;
        
        await message.edit({ 
          content: `${newText}\n\n*(Edited manually by R4/R5: ${interaction.user.tag})*`,
          components: message.components // Preserve the original ActionRow buttons
        });

        // Audit Log
        const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: interaction.guildId } });
        if (config && config.audit_channel) {
          const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
          if (auditChannel) {
            await auditChannel.send(`📝 **Audit Log:** R4/R5 <@${interaction.user.id}> manually edited an AI strategy guide.`);
          }
        }

        return interaction.reply({ content: '✅ The AI message has been updated!', flags: 64 });
      }

      if (interaction.customId === 'modal_schedule') {
        const name = interaction.fields.getTextInputValue('event_name');
        const dateStr = interaction.fields.getTextInputValue('event_date');
        const timeStr = interaction.fields.getTextInputValue('event_time');
        
        try {
          const scheduledDate = new Date(`${dateStr}T${timeStr}:00Z`);
          if (isNaN(scheduledDate.getTime())) {
            return interaction.reply({ content: '❌ Invalid date/time format. Please use YYYY-MM-DD and HH:MM.', flags: 64 });
          }

          const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);
          
          const event = await client.prisma.event.create({
            data: {
              guild_id: interaction.guildId,
              name: name,
              scheduled_time: scheduledDate,
              created_by: interaction.user.id
            }
          });

          const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`📅 Upcoming Event: ${name}`)
            .setDescription(`**Time:** <t:${unixTimestamp}:F>\n**Countdown:** <t:${unixTimestamp}:R>\n\n**RSVP Roster:**\n🛡️ Infantry: 0\n🐎 Lancers: 0\n🏹 Marksmen: 0`)
            .setFooter({ text: 'Scheduled by ' + interaction.user.tag });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rsvp_INFANTRY_${event.id}`).setLabel('🛡️ Infantry').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rsvp_LANCER_${event.id}`).setLabel('🐎 Lancer').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`rsvp_MARKSMAN_${event.id}`).setLabel('🏹 Marksman').setStyle(ButtonStyle.Success)
          );

          await interaction.channel.send({ content: '@everyone', embeds: [embed], components: [row] });
          return interaction.reply({ content: '✅ Event scheduled successfully via Control Panel.', flags: 64 });
        } catch (err) {
          logger.error(err, 'Event schedule error');
          return interaction.reply({ content: '❌ Error scheduling event: ' + err.message, flags: 64 });
        }
      }

      if (interaction.customId === 'modal_nap') {
        const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: interaction.guildId } });
        if (!config || config.mode !== 'KINGDOM') {
          return interaction.reply({ content: '❌ NAP Management is only available in Kingdom Mode.', flags: 64 });
        }

        const tag = interaction.fields.getTextInputValue('main_tag').toUpperCase();
        let academyTag = null;
        try { academyTag = interaction.fields.getTextInputValue('academy_tag').toUpperCase(); } catch(e){}

        await client.prisma.nAPAlliance.upsert({
          where: { guild_id_tag: { guild_id: interaction.guildId, tag: tag } },
          update: { added_by: interaction.user.id, academy_tag: academyTag },
          create: { guild_id: interaction.guildId, tag: tag, academy_tag: academyTag, added_by: interaction.user.id }
        });

        return interaction.reply({ content: `✅ **[${tag}]** ${academyTag ? `(and Academy [${academyTag}])` : ''} added to NAP List via Control Panel.`, flags: 64 });
      }

      if (interaction.customId === 'modal_verify') {
        const inGameName = interaction.fields.getTextInputValue('in_game_name');
        let allianceTag = null;
        try { allianceTag = interaction.fields.getTextInputValue('alliance_tag'); } catch(e){}

        await interaction.deferReply({ flags: 64 });

        try {

          const discordMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
          const hasOfficialRole = discordMember && (
            discordMember.roles.cache.has(process.env.ROLE_MEMBER_ID) ||
            discordMember.roles.cache.has(process.env.ROLE_R4_ID) ||
            discordMember.roles.cache.has(process.env.ROLE_R5_ID)
          );

          if (!hasOfficialRole) {
            return interaction.editReply('⛔ You do not have the official Alliance Discord role yet. Please use `/register` to request manual approval from an R4.');
          }

          let assumedRole = 'MEMBER';
          if (discordMember.roles.cache.has(process.env.ROLE_R5_ID)) assumedRole = 'R5';
          else if (discordMember.roles.cache.has(process.env.ROLE_R4_ID)) assumedRole = 'R4';

          await client.prisma.member.upsert({
            where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
            update: { in_game_name: inGameName, alliance_tag: allianceTag, role: assumedRole, is_verified: true },
            create: { discord_id: interaction.user.id, guild_id: interaction.guildId, in_game_name: inGameName, alliance_tag: allianceTag, role: assumedRole, is_verified: true }
          });

          if (discordMember) {
            try {
              const nickname = allianceTag 
                ? `[${allianceTag}] ${inGameName} - ${assumedRole}`
                : `${inGameName} - ${assumedRole}`;
              await discordMember.setNickname(nickname.substring(0, 32));
            } catch (err) {
              logger.error(err, 'Failed to rename member in auto-verify');
            }
          }

          return interaction.editReply(`✅ **Identity Linked!** You have been auto-verified as **${inGameName}** based on your existing Discord roles.`);
        } catch (err) {
          logger.error(err, 'Error in modal_verify');
          return interaction.editReply('❌ Failed to verify identity.');
        }
      }
      if (interaction.customId === 'modal_register') {
        const inGameName = interaction.fields.getTextInputValue('in_game_name');
        const roleInput = interaction.fields.getTextInputValue('role').toUpperCase().trim();
        let allianceTag = null;
        try { allianceTag = interaction.fields.getTextInputValue('alliance_tag'); } catch(e){}

        if (roleInput !== 'MEMBER' && roleInput !== 'R4' && roleInput !== 'R5') {
          return interaction.reply({ content: '❌ Invalid Role. Please type exactly: MEMBER, R4, or R5.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        try {
          await client.prisma.member.upsert({
            where: {
              discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId }
            },
            update: { in_game_name: inGameName, role: roleInput, alliance_tag: allianceTag, is_verified: false },
            create: { discord_id: interaction.user.id, guild_id: interaction.guildId, in_game_name: inGameName, role: roleInput, alliance_tag: allianceTag, is_verified: false }
          });

          const config = await client.prisma.guildConfig.findUnique({
            where: { guild_id: interaction.guildId }
          });

          if (!config || !config.alert_channel) {
            return interaction.editReply('Server is not setup correctly. Admin needs to run /setup first.');
          }

          const alertChannel = await interaction.guild.channels.fetch(config.alert_channel).catch(() => null);
          if (!alertChannel) {
            return interaction.editReply('Alert channel not found. Please contact an admin.');
          }

          const embed = new EmbedBuilder()
            .setTitle('🛡️ New Registration Request')
            .setDescription(`User <@${interaction.user.id}> has requested to register.`)
            .addFields(
              { name: 'In-Game Name', value: inGameName, inline: true },
              { name: 'Requested Role', value: roleInput, inline: true }
            )
            .setColor('#FFA500')
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`approve_${interaction.user.id}_${interaction.guildId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`reject_${interaction.user.id}_${interaction.guildId}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
          );

          const isOwner = interaction.user.id === interaction.guild.ownerId;
          if (isOwner) {
            await client.prisma.member.update({
              where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
              data: { is_verified: true, role: 'R5' }
            });
            
            try {
              const discordMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
              if (discordMember) {
                const nickname = allianceTag ? `[${allianceTag}] ${inGameName} - R5` : `${inGameName} - R5`;
                await discordMember.setNickname(nickname.substring(0, 32));
              }
            } catch (err) {
              logger.warn('Could not rename Server Owner due to Discord Permission Hierarchy.');
            }

            embed.setTitle('🛡️ New Registration Request (AUTO-APPROVED)')
                 .setDescription(`User <@${interaction.user.id}> is the Server Owner and was automatically verified as R5.`);
            await alertChannel.send({ embeds: [embed] });
            return interaction.editReply(`👑 **Server Owner Recognized!** You have been automatically verified as **${inGameName} (R5)**.\n*(Note: Discord does not allow bots to change the Server Owner's nickname, so you may need to update it manually!)*`);
          }

          const discordMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
          if (discordMember) {
            const hasOfficialRole = 
              discordMember.roles.cache.has(process.env.ROLE_MEMBER_ID) ||
              discordMember.roles.cache.has(process.env.ROLE_R4_ID) ||
              discordMember.roles.cache.has(process.env.ROLE_R5_ID);

            if (hasOfficialRole) {
              await client.prisma.member.update({
                where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } },
                data: { is_verified: true }
              });
              
              try {
                const nickname = allianceTag ? `[${allianceTag}] ${inGameName} - ${roleInput}` : `${inGameName} - ${roleInput}`;
                await discordMember.setNickname(nickname.substring(0, 32));
              } catch (err) {
                logger.warn('Could not rename Auto-Migrated user.');
              }

              embed.setTitle('🛡️ New Registration Request (AUTO-MIGRATED)')
                   .setDescription(`User <@${interaction.user.id}> already held an official Discord Role. They have been Auto-Verified.`);
              await alertChannel.send({ embeds: [embed] });
              return interaction.editReply(`✅ **Auto-Verification Successful!** Since you already have an Alliance role in this server, your Identity has been securely linked without needing R4 approval.`);
            }
          }

          await alertChannel.send({ embeds: [embed], components: [row] });
          await interaction.editReply(`✅ Registration submitted for **${inGameName}** (${roleInput}). Please wait for R4/R5 approval in the alert channel.`);
        } catch (error) {
          logger.error(error, 'Error in modal_register');
          return interaction.editReply('❌ Failed to process registration.');
        }
      }

      return;
    }

    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(error, `Error executing command: ${interaction.commandName}`);
      
      const errorMessage = { content: 'There was an error while executing this command!', flags: 64 };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

async function handleButtonInteraction(interaction, client) {
  const { customId } = interaction;
  
  if (customId === 'ui_schedule_event') {
    const modal = new ModalBuilder()
      .setCustomId('modal_schedule')
      .setTitle('Schedule an Event');

    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('event_name').setLabel('Event Name').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('event_date').setLabel('Date (YYYY-MM-DD)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('event_time').setLabel('UTC Time (HH:MM)').setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === 'ui_verify_me') {
    const modal = new ModalBuilder()
      .setCustomId('modal_verify')
      .setTitle('Link Kingshot Identity');

    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_game_name').setLabel('Exact In-Game Name').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('alliance_tag').setLabel('Alliance Tag (Optional)').setStyle(TextInputStyle.Short).setRequired(false))
    );
    return interaction.showModal(modal);
  }

  if (customId === 'ui_manage_nap') {
    const modal = new ModalBuilder()
      .setCustomId('modal_nap')
      .setTitle('Add Alliance to NAP');

    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('main_tag').setLabel('Main Alliance Tag (e.g. K99)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('academy_tag').setLabel('Academy Tag (Optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(5))
    );
    return interaction.showModal(modal);
  }

  if (customId.startsWith('approve_') || customId.startsWith('reject_')) {
    const [action, targetId, targetGuildId] = customId.split('_');

    // Security: Check if the person clicking the button is an R4/R5
    const clicker = await client.prisma.member.findUnique({
      where: {
        discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId }
      }
    });

    if (!clicker || (clicker.role !== 'R4' && clicker.role !== 'R5') || !clicker.is_verified) {
      return interaction.reply({ content: '⛔ Only verified R4/R5 can approve or reject registrations.', flags: 64 });
    }

    // Process Approval
    if (action === 'approve') {
      const updatedMember = await client.prisma.member.update({
        where: {
          discord_id_guild_id: {
            discord_id: targetId,
            guild_id: interaction.guildId
          }
        },
        data: { is_verified: true }
      });

      // Assign Roles in Discord
      const roleMapping = {
        'MEMBER': process.env.ROLE_MEMBER_ID,
        'R4': process.env.ROLE_R4_ID,
        'R5': process.env.ROLE_R5_ID
      };

      const roleId = roleMapping[updatedMember.role];
      const discordMember = await interaction.guild.members.fetch(targetId).catch(() => null);
      
      if (discordMember && roleId) {
        await discordMember.roles.add(roleId).catch(err => logger.error(err, 'Failed to assign role'));
      }

      // Rename Discord User (Kingdom vs Solo mode)
      if (discordMember) {
        try {
          const nickname = updatedMember.alliance_tag 
            ? `[${updatedMember.alliance_tag}] ${updatedMember.in_game_name} - ${updatedMember.role}`
            : `${updatedMember.in_game_name} - ${updatedMember.role}`;
          
          await discordMember.setNickname(nickname.substring(0, 32)); // Discord limit is 32 chars
        } catch (err) {
          logger.error(err, 'Failed to rename member');
        }
      }

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#00FF00')
        .setTitle('✅ Registration Approved')
        .setFooter({ text: `Approved by ${interaction.user.tag}` });
      
      await interaction.update({ embeds: [embed], components: [] });

      // DM the user
      try {
        const targetUser = await client.users.fetch(targetId);
        if (targetUser) await targetUser.send(`Your registration for Kingshot Bot in guild ${interaction.guild.name} has been **APPROVED**!`);
      } catch (err) {
        logger.warn(`Could not DM user ${targetId}`);
      }

      // Audit Log
      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: interaction.guildId } });
      if (config && config.audit_channel) {
        const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
        if (auditChannel) {
          await auditChannel.send(`📝 **Audit Log:** R4/R5 <@${interaction.user.id}> **APPROVED** registration for <@${targetId}>.`);
        }
      }

    } else if (action === 'reject') {
      await client.prisma.member.delete({
        where: { discord_id_guild_id: { discord_id: targetId, guild_id: targetGuildId } }
      });

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#FF0000')
        .setTitle('❌ Registration Rejected')
        .setFooter({ text: `Rejected by ${interaction.user.tag}` });
      
      await interaction.update({ embeds: [embed], components: [] });

      // Audit Log
      const config = await client.prisma.guildConfig.findUnique({ where: { guild_id: interaction.guildId } });
      if (config && config.audit_channel) {
        const auditChannel = await interaction.guild.channels.fetch(config.audit_channel).catch(() => null);
        if (auditChannel) {
          await auditChannel.send(`📝 **Audit Log:** R4/R5 <@${interaction.user.id}> **REJECTED** registration for <@${targetId}>.`);
        }
      }
    }
  } else if (customId === 'edit_ai_message') {
    // Verify user is R4 or R5
    const clicker = await client.prisma.member.findUnique({
      where: {
        discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId }
      }
    });

    if (!clicker || (clicker.role !== 'R4' && clicker.role !== 'R5') || !clicker.is_verified) {
      return interaction.reply({ content: '⛔ Only verified R4/R5 can edit AI messages.', flags: 64 });
    }

    const currentContent = interaction.message.content || 'Error reading message content.';
    // Truncate to 4000 characters which is the Modal TextInput maximum limit
    const truncatedContent = currentContent.substring(0, 4000);

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_ai')
      .setTitle('Edit AI Guide/Reminder');

    const textInput = new TextInputBuilder()
      .setCustomId('ai_text_input')
      .setLabel("Message Content")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setValue(truncatedContent);

    const row = new ActionRowBuilder().addComponents(textInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

  } else if (customId === 'daily_checkin') {
    // Process silent check-in
    const discordId = interaction.user.id;
    const guildId = interaction.guildId;

    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: discordId, guild_id: guildId } }
    });

    if (!member) {
      return interaction.reply({ content: '❌ You must be registered to check in.', flags: 64 });
    }

    const now = new Date();
    // 24 hour cooldown check
    if (member.last_checkin) {
      const hoursSinceLast = (now - member.last_checkin) / (1000 * 60 * 60);
      if (hoursSinceLast < 24) {
        const hoursLeft = Math.ceil(24 - hoursSinceLast);
        return interaction.reply({ content: `⏱️ You have already checked in recently. Please wait ${hoursLeft} more hours.`, flags: 64 });
      }
    }

    await client.prisma.member.update({
      where: { discord_id_guild_id: { discord_id: discordId, guild_id: guildId } },
      data: { 
        last_checkin: now,
        last_active: now,
        activity_score: member.activity_score + 5 
      }
    });

    await interaction.reply({ content: '✅ Daily Check-in complete! You earned +5 Activity Points.', flags: 64 });

  } else if (customId.startsWith('trivia_')) {
    // Expected format: trivia_correct_123456789 or trivia_wrong_123456789
    const parts = customId.split('_');
    const isCorrect = parts[1] === 'correct';
    
    // Check if user is registered
    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
    });

    if (!member) {
      return interaction.reply({ content: '❌ You must be registered to play Trivia.', flags: 64 });
    }

    // Disable all buttons so no one else can click
    const message = interaction.message;
    const components = message.components[0].components.map(btn => 
      ButtonBuilder.from(btn).setDisabled(true)
    );
    const disabledRow = new ActionRowBuilder().addComponents(components);

    if (isCorrect) {
      await client.prisma.member.update({
        where: { discord_id_guild_id: { discord_id: member.discord_id, guild_id: interaction.guildId } },
        data: { activity_score: member.activity_score + 10 }
      });
      
      await message.edit({ content: `${message.content}\n\n🏆 **Winner:** <@${interaction.user.id}> got it first! (+10 Points)`, components: [disabledRow] });
      await interaction.reply({ content: '✅ Correct! You won the trivia.', flags: 64 });
    } else {
      await message.edit({ content: `${message.content}\n\n❌ **Wrong Answer by:** <@${interaction.user.id}>! Better luck tomorrow.`, components: [disabledRow] });
      await interaction.reply({ content: '❌ Incorrect answer!', flags: 64 });
    }

  } else if (customId.startsWith('verify_violation_')) {
    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
    });
    if (!member || (member.role !== 'R4' && member.role !== 'R5')) {
      return interaction.reply({ content: '⛔ Only R4/R5 can verify strikes.', flags: 64 });
    }
    const tag = customId.split('_')[2];
    await interaction.message.edit({ content: `✅ **Strike Verified by <@${interaction.user.id}>** against [${tag}].`, components: [] });
    await interaction.reply({ content: 'Violation logged.', flags: 64 });

  } else if (customId === 'ignore_violation') {
    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
    });
    if (!member || (member.role !== 'R4' && member.role !== 'R5')) {
      return interaction.reply({ content: '⛔ Only R4/R5 can ignore alerts.', flags: 64 });
    }
    await interaction.message.edit({ content: `❌ **False Alarm - Ignored by <@${interaction.user.id}>**`, components: [] });
    await interaction.reply({ content: 'Alert dismissed.', flags: 64 });

  } else if (customId.startsWith('rsvp_')) {
    // Expected format: rsvp_INFANTRY_eventId
    const parts = customId.split('_');
    const troopType = parts[1];
    const eventId = parts[2];
    const discordId = interaction.user.id;

    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: discordId, guild_id: interaction.guildId } }
    });

    if (!member) {
      return interaction.reply({ content: '❌ You must be registered to RSVP.', flags: 64 });
    }

    // Upsert RSVP
    await client.prisma.eventRSVP.upsert({
      where: { event_id_discord_id: { event_id: eventId, discord_id: discordId } },
      update: { troop_type: troopType },
      create: { event_id: eventId, discord_id: discordId, troop_type: troopType }
    });

    // Recalculate Live Roster
    const allRsvps = await client.prisma.eventRSVP.findMany({ where: { event_id: eventId } });
    const counts = { INFANTRY: 0, LANCER: 0, MARKSMAN: 0 };
    allRsvps.forEach(r => counts[r.troop_type]++);

    const oldEmbed = interaction.message.embeds[0];
    const newDesc = oldEmbed.description.replace(
      /\*\*RSVP Roster:\*\*\n🛡️ Infantry: \d+\n🐎 Lancers: \d+\n🏹 Marksmen: \d+/,
      `**RSVP Roster:**\n🛡️ Infantry: ${counts.INFANTRY}\n🐎 Lancers: ${counts.LANCER}\n🏹 Marksmen: ${counts.MARKSMAN}`
    );

    const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(newDesc);
    await interaction.message.edit({ embeds: [newEmbed] });
    await interaction.reply({ content: `✅ Successfully RSVP'd as **${troopType}**.`, flags: 64 });

  } else if (customId.startsWith('join_rally_')) {
    // Handle silent engagement for rallies
    const message = interaction.message;
    const embed = message.embeds[0];
    if (!embed) return interaction.reply({ content: 'Error parsing embed.', flags: 64 });

    let description = embed.description;
    const maxPlayersMatch = embed.footer?.text?.match(/max:(\d+)/);
    const maxPlayers = maxPlayersMatch ? parseInt(maxPlayersMatch[1]) : 30;

    // Extract current joiners
    const joinersSection = description.split('**Joiners')[1];
    let joinersLines = joinersSection.split('\\n').map(l => l.trim()).filter(l => l);
    // Remove the first line which is "(X/Y):**"
    joinersLines.shift();
    if (joinersLines[0] === '*None yet*') joinersLines.shift();

    const userName = interaction.member?.nickname || interaction.user.username;
    const userString = `- <@${interaction.user.id}> (${userName})`;

    if (joinersLines.includes(userString)) {
      return interaction.reply({ content: 'You have already joined this rally.', flags: 64 });
    }

    if (joinersLines.length >= maxPlayers) {
      return interaction.reply({ content: 'This rally is full!', flags: 64 });
    }

    joinersLines.push(userString);
    
    // Reconstruct description
    const newDescription = description.split('**Joiners')[0] + `**Joiners (${joinersLines.length}/${maxPlayers}):**\n` + joinersLines.join('\n');

    const newEmbed = EmbedBuilder.from(embed).setDescription(newDescription);

    await message.edit({ embeds: [newEmbed] });
    await interaction.reply({ content: '✅ You have successfully joined the rally!', flags: 64 });
  } else if (customId.startsWith('vote_yes_') || customId.startsWith('vote_no_')) {
    const voteId = customId.split('_')[2];
    
    // Check if voter is verified and authorized based on DB
    const member = await client.prisma.member.findUnique({
      where: { discord_id_guild_id: { discord_id: interaction.user.id, guild_id: interaction.guildId } }
    });

    if (!member || !member.is_verified) {
      return interaction.reply({ content: '⛔ You must be verified to vote.', flags: 64 });
    }

    const voteRecord = await client.prisma.vote.findUnique({ where: { id: voteId } });
    if (!voteRecord) {
      return interaction.reply({ content: '❌ This vote has ended or was deleted.', flags: 64 });
    }

    if (voteRecord.restricted_to === 'R4' && member.role !== 'R4' && member.role !== 'R5') {
      return interaction.reply({ content: '⛔ This vote is restricted to R4 & R5 only.', flags: 64 });
    }

    // In a full implementation, we'd store the vote in a Voter table to prevent double voting.
    // For now, we will parse the embed to dynamically update the tally for demonstration.
    const message = interaction.message;
    const embed = message.embeds[0];
    if (!embed) return interaction.reply({ content: 'Error parsing embed.', flags: 64 });

    let tallyStr = embed.fields.find(f => f.name === 'Current Tally').value; // "Yes: X | No: Y"
    let [yesPart, noPart] = tallyStr.split('|');
    let yesCount = parseInt(yesPart.replace('Yes:', '').trim());
    let noCount = parseInt(noPart.replace('No:', '').trim());

    if (customId.startsWith('vote_yes_')) yesCount++;
    if (customId.startsWith('vote_no_')) noCount++;

    const newFields = embed.fields.map(f => {
      if (f.name === 'Current Tally') {
        return { name: 'Current Tally', value: `Yes: ${yesCount} | No: ${noCount}`, inline: true };
      }
      return f;
    });

    const newEmbed = EmbedBuilder.from(embed).setFields(newFields);

    await message.edit({ embeds: [newEmbed] });
    await interaction.reply({ content: '✅ Your anonymous vote has been cast.', flags: 64 });
  }
}
