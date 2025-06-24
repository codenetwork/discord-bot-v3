const {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
} = require('discord.js');
const {
  isInviteValid,
  createSession,
  sessionInit,
  denySession,
  expireSession,
  cancelSession,
  sessions,
} = require('../../utils/battleship/sessionManagement.js');
const { generateMainInterface } = require('../../utils/battleship/boardSetupHandler.js');

// TODO:
// 1. Create categories ✅
// 2. Delete categories ✅
// 3. Create text channels ✅
// 4. Send private DMs to members ✅
// 5. Send private DMs with buttons to members ✅
// 6. Members reply to private DMs ✅
// 7. Implement central sessions list. A new session object is create the second an invite is created.
//    Handle cases where invitation is denied or not responded (just change the status, and maybe no need
//    to remove the session) ✅
// 8. Implement cancel invite ✅
// 9. Implement game initialization to enter the "board_setup" phase if the invitee accepts:
//      a. Implement utility function to setup board: store players' id, board, guess boards, textchannelId ✅
//      b. Implement text channel creation with permissions for respective players and redirect players to
//         respective channels if possible. Or at least give them a link to their text channel. ✅
//      c. Implement utility functions for players to set their board, methods include:
//          i. Place ship (handles which orientation, valid ship placements)
//         ii. Finish method to indicate that they're finished (handles if all ships are placed)
//        iii. Maybe a remove ship method to undo a ship placement.

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battleship')
    .setDescription('Manage the battleship game')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('createcategory')
        .setDescription('Creates a new category given a name.')
        .addStringOption((option) =>
          option.setName('name').setDescription('Name of the category to create').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deletecategory')
        .setDescription('Deletes a category')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the category to be deleted.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('createtextchannel')
        .setDescription('Creates a new text channel at category "Battleship".')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the text channel to be created.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('invite')
        .setDescription('Invites another player to play')
        .addUserOption((option) =>
          option.setName('player').setDescription('The player you want to invite').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('invite-cancel').setDescription('Cancels your invite')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'createcategory') {
      const categoryName = interaction.options.getString('name');

      const existingCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === categoryName && channel.type === ChannelType.GuildCategory
      );

      if (existingCategory) {
        return await interaction.reply({
          content: `Category "${categoryName}" already exists!`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      try {
        const newCategory = await interaction.guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory,
        });
        return await interaction.reply(`Category "${categoryName}" has been created!`);
      } catch (error) {
        interaction.reply({
          content: `Failed to create category "${categoryName}" :(\n${error}`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'deletecategory') {
      const categoryName = interaction.options.getString('name');

      const existingCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === categoryName && channel.type === ChannelType.GuildCategory
      );

      if (!existingCategory) {
        return await interaction.reply({
          content: `Category "${categoryName}" does not exist!`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      try {
        await existingCategory.delete();
        return await interaction.reply(`Category "${categoryName}" has been deleted!`);
      } catch (error) {
        return await interaction.reply({
          content: `Failed to delete "${categoryName}" :(`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'createtextchannel') {
      const battleshipCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === 'Battleship' && channel.type === ChannelType.GuildCategory
      );

      if (!battleshipCategory) {
        return await interaction.reply({
          content: `Category "Battleship" not found. Please create this category first.`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      const textChannelName = interaction.options.getString('name');

      try {
        const newChannel = await interaction.guild.channels.create({
          name: textChannelName,
          type: ChannelType.GuildText,
          parent: battleshipCategory.id,
          // permissionOverwrites: [
          //   id:
          // ]
        });
        return await interaction.reply(`Text channel "${newChannel.name}" has been created!`);
      } catch (error) {}
    } else if (subcommand === 'invite') {
      const inviter = interaction.user;
      const invitee = interaction.options.getUser('player');

      // In case invitee is invalid
      if (!invitee || inviter.id == invitee.id) {
        return await interaction.reply({
          content: 'You must invite a valid player!',
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      if (!(await isInviteValid(interaction, inviter, invitee))) {
        return;
      }

      // Creates a new session,
      // also adds to `sessions`
      const session = createSession(inviter, invitee);

      try {
        // Build DM message
        const accept = new ButtonBuilder()
          .setCustomId('accept_invite')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success);

        const deny = new ButtonBuilder()
          .setCustomId('deny_invite')
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(accept, deny);

        // Try sending DM message to invitee
        let dmMessage;
        try {
          dmMessage = await invitee.send({
            content: `You've been invited by ${inviter} to play Battleship!`,
            components: [row],
            withResponse: true,
          });

          session.dm = { channelId: dmMessage.channel.id, messageId: dmMessage.id };

          // Tell inviter that the invitation has been sent
          await interaction.reply({
            content: `Invitation sent to ${invitee}.`,
            ephemeral: MessageFlags.Ephemeral,
          });
        } catch (dmError) {
          console.error('Failed to send DM: ', dmError);
          return await interaction.reply({
            content: `Could not send a DM to ${invitee} They may have DMs disabled.`,
            ephemeral: MessageFlags.Ephemeral,
          });
        }

        let inviteeResponse;
        try {
          // Wait for invitee's response
          const inviteeFilter = (i) => i.user.id === invitee.id;

          inviteeResponse = await dmMessage.awaitMessageComponent({
            filter: inviteeFilter,
            time: 60_000, // 60 seconds to accept the invite
          });
        } catch (timeoutError) {
          console.error('Invitation timed out:', timeoutError);

          // Check if the invite is still pending (aka not cancelled)
          if (session.status !== 'invite_pending') {
            return;
          }

          // Mark session's invitation as expired
          expireSession(session);
          console.log(sessions);

          // Set buttons to disabled
          accept.setDisabled(true);
          deny.setDisabled(true);

          // Tell invitee that the invitation has expired
          await dmMessage.edit({
            content: `You've been invited by ${inviter} to play Battleship!\nUnfortunately, you didn't respond in time.`,
            components: [row],
          });

          // Tell inviter that the invitation has expired
          return await interaction.followUp({
            content: `${invitee} didn't respond to the invite in time.`,
            ephemeral: MessageFlags.Ephemeral,
          });
        }

        // Handle invitee's response
        if (inviteeResponse.customId === 'accept_invite') {
          // Invitee accepts the invitation

          // Initialize session
          await sessionInit(interaction, session, inviter, invitee);
          console.log(sessions);

          const p1textChannel = await interaction.client.channels.fetch(session.p1.textChannelId);

          // const textDisplay = new TextDisplayBuilder().setContent(
          //   '# Sasimbegu\nanjing lucune ahh ahh ahh ah ah'
          // );

          const p1textChannelMessage = await p1textChannel.send({
            components: generateMainInterface(session, 'p1'),
            flags: MessageFlags.IsComponentsV2,
          });
          session.p1.messageId = p1textChannelMessage.id;

          const p2textChannel = await interaction.client.channels.fetch(session.p2.textChannelId);
          const p2textChannelMessage = await p2textChannel.send({
            content: 'ahh',
          });
          session.p2.messageId = p2textChannelMessage.id;

          // Tell invintee that they've accepted the invitation
          await inviteeResponse.update({
            content: `You accepted an invite from ${inviter} to play Battleship! Head over to your game channel <#${session.p2.textChannelId}>`,
            components: [],
          });

          // Tell inviter that invitee has accepted the invitation
          return await interaction.followUp({
            content: `${invitee} has accepted your invite! Head over to your game channel <#${session.p1.textChannelId}>`,
            ephemeral: MessageFlags.Ephemeral,
          });
        } else if (inviteeResponse.customId === 'deny_invite') {
          // Invitee denies the invitation

          // Mark session's invitation as denied
          denySession(session);
          console.log(sessions);

          // Tell invitee that they've denied the invitation
          await inviteeResponse.update({
            content: `You denied ${inviter}'s invite!`,
            components: [],
          });

          // Tell inviter that invitee has denied the invitation
          return await interaction.followUp({
            content: `${invitee} has denied your invite!`,
            ephemeral: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        return interaction.reply({
          content: 'An unexpected error occurred while processing the invite.',
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'invite-cancel') {
      const client = interaction.client;
      const inviter = interaction.user;
      const pendingInviteSession = sessions.find(
        (session) => session.p1.id === inviter.id && session.status === 'invite_pending'
      );

      // Doesn't have pending invites
      if (!pendingInviteSession) {
        return interaction.reply({
          content: "You don't have any pending invites!",
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      const invitee = await client.users.fetch(pendingInviteSession.p2.id);

      // Getting dmInteraction
      const { channelId: dmChannelId, messageId: dmMessageId } = pendingInviteSession.dm;
      const dmChannel = await client.channels.fetch(dmChannelId);
      const dmMessage = await dmChannel.messages.fetch(dmMessageId);

      // Set buttons to disabled
      const row = ActionRowBuilder.from(dmMessage.components[0]);
      row.components = row.components.map((component) =>
        ButtonBuilder.from(component).setDisabled(true)
      );

      cancelSession(pendingInviteSession);

      // Tell invitee that the invite is cancelled
      await dmMessage.edit({
        content: `You've been invited by ${inviter} to play Battleship!\n${inviter} cancelled the invitation.`,
        components: [row],
      });

      // Tell the inviter that the cancellation has been made
      return await interaction.reply({
        content: `Your invite to ${invitee} has been cancelled!`,
        ephemeral: MessageFlags.Ephemeral,
      });
    }
  },
};
