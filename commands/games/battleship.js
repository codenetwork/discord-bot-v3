const {
  SlashCommandBuilder,
  ChannelType,
  PermissionOverwrites,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  createSession,
  sessionInit,
  denySession,
  expireSession,
} = require('../../utils/battleship.js');

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
// 8. Implement game initialization to enter the "board_setup" phase if the invitee accepts:
//      a. Implement utility function to setup board: store players' id, board, guess boards, textchannelId
//      b. Implement text channel creation with permissions for respective players and redirect players to
//         respective channels if possible. Or at least give them a link to their text channel.
//      c. Implement utility functions for players to set their board, methods include:
//          i. Place ship (handles which orientation, valid ship placements)
//         ii. Finish method to indicate that they're finished (handles if all ships are placed)
//        iii. Maybe a remove ship method to undo a ship placement.

const sessions = [];

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
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'createcategory') {
      const categoryName = interaction.options.getString('name');

      const existingCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === categoryName && channel.type === ChannelType.GuildCategory
      );

      if (existingCategory) {
        return interaction.reply({
          content: `Category "${categoryName}" already exists!`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      try {
        const newCategory = await interaction.guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory,
        });
        interaction.reply(`Category "${categoryName}" has been created!`);
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
        return interaction.reply({
          content: `Category "${categoryName}" does not exist!`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      try {
        await existingCategory.delete();
        return interaction.reply(`Category "${categoryName}" has been deleted!`);
      } catch (error) {
        return interaction.reply({
          content: `Failed to delete "${categoryName}" :(`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'createtextchannel') {
      const battleshipCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === 'Battleship' && channel.type === ChannelType.GuildCategory
      );

      if (!battleshipCategory) {
        return interaction.reply({
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
        return interaction.reply(`Text channel "${newChannel.name}" has been created!`);
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

      // Check if the inviter is already in an active session
      const activeStatuses = ['invite_pending', 'board_setup', 'turn_p1', 'turn_p2'];
      const inviterActiveSession = sessions.find(
        (session) => session.p1.id === inviter.id && activeStatuses.includes(session.status)
      );
      if (inviterActiveSession) {
        return await interaction.reply({
          content:
            'You already have an active game or pending invite. Either finish your game or cancel your invite before inviting another player.',
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      // Check if the invitee is in an active session
      const inviteeActiveSession = sessions.find(
        (session) => session.p1.id === invitee.id && activeStatuses.includes(session.status)
      );
      if (inviteeActiveSession) {
        return await interaction.reply({
          content: `${invitee} either has an active invite or is currently in a game. Tell them to cancel their invite or finish their game!`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      // Check if inviter is already invited by someone
      const inviterIsInvitedSession = sessions.find(
        (session) => session.status === 'invite_pending' && session.p2.id === inviter.id
      );
      if (inviterIsInvitedSession) {
        return await interaction.reply({
          content: 'You are invited by someone, check your DMs and respond to them first!',
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      // Check if invitee is already invited by someone
      const inviteeIsInvitedSession = sessions.find(
        (session) => session.status === 'invite_pending' && session.p2.id === invitee.id
      );
      if (inviteeIsInvitedSession) {
        return await interaction.reply({
          content: `${invitee} is being invited by someone else. Unfortunately, they would have to respond to their invite first.`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      const session = createSession(sessions, inviter, invitee);

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
        let dmInteraction;
        try {
          dmInteraction = await invitee.send({
            content: `You've been invited by ${inviter} to play Battleship!`,
            components: [row],
            withResponse: true,
          });

          // Tell inviter that the invitation has been sent
          await interaction.reply({
            content: `Invitation sent to ${invitee}.`,
            ephemeral: MessageFlags.Ephemeral,
          });
        } catch (dmError) {
          console.error('Failed to send DM: ', error);
          return await interaction.reply({
            content: `Could not send a DM to ${invitee} They may have DMs disabled.`,
            ephemeral: MessageFlags.Ephemeral,
          });
        }

        let inviteeResponse;
        try {
          // Wait for invitee's response
          const collectionFilter = (i) => i.user.id === invitee.id;

          inviteeResponse = await dmInteraction.awaitMessageComponent({
            filter: collectionFilter,
            time: 60_000, // 60 seconds to accept the invite
          });
        } catch (timeoutError) {
          console.error('Invitation timed out:', timeoutError);

          // Mark session's invitation as expired
          expireSession(session);
          console.log(sessions);

          // Set buttons to disabled
          accept.setDisabled(true);
          deny.setDisabled(true);

          // Tell invitee that the invitation has expired
          await dmInteraction.edit({
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

          // Tell invintee that they've accepted the invitation
          await inviteeResponse.update({
            content: `You accepted an invite from ${inviter} to play Battleship!`,
            components: [],
          });

          // Tell inviter that invitee has accepted the invitation
          return await interaction.followUp({
            content: `${invitee} has accepted your invite!`,
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
    }
  },
};
