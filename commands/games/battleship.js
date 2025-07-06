const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
const { startBoardSetup } = require('../../utils/battleship/boardSetup.js');
const { TIMEOUT_INVITE } = require('../../utils/battleship/constants.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battleship')
    .setDescription('Manage the battleship game')
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

    if (subcommand === 'invite') {
      const inviter = interaction.user;
      const invitee = interaction.options.getUser('player');

      // Validation
      if (!invitee || inviter.id == invitee.id) {
        return await interaction.reply({
          content: 'You must invite a valid player!',
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      if (!(await isInviteValid(interaction, inviter, invitee))) {
        return;
      }

      // Create session
      const session = createSession(inviter, invitee);

      // Build DM components
      const accept = new ButtonBuilder()
        .setCustomId('accept_invite')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success);

      const deny = new ButtonBuilder()
        .setCustomId('deny_invite')
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(accept, deny);

      // Try to send DM
      try {
        const dmMessage = await invitee.send({
          content: `You've been invited by ${inviter} to play Battleship!`,
          components: [row],
        });

        session.dm = { channelId: dmMessage.channel.id, messageId: dmMessage.id };

        // Create collector for the DM message
        const collector = dmMessage.createMessageComponentCollector({
          filter: (i) => i.user.id === invitee.id,
          time: TIMEOUT_INVITE,
        });

        // Store collector reference in session for cleanup
        session.inviteCollector = collector;

        collector.on('collect', async (inviteeResponse) => {
          // Create disabled buttons
          const disabledAccept = ButtonBuilder.from(accept).setDisabled(true);
          const disabledDeny = ButtonBuilder.from(deny).setDisabled(true);
          const disabledRow = new ActionRowBuilder().addComponents(disabledAccept, disabledDeny);

          try {
            if (inviteeResponse.customId === 'accept_invite') {
              // Tell invitee that they've interacted with the accept button
              await inviteeResponse.update({
                content: `You've been invited by ${inviter} to play Battleship!\n✅ **Accepted!** Please wait while we set up your game...`,
                components: [disabledRow],
              });

              await sessionInit(interaction, session, inviter, invitee);

              // Start the board setup phase
              await startBoardSetup(interaction, session);

              // Tell invitee they've accepted
              await inviteeResponse.followUp(
                `Head over to your game channel <#${session.p2.textChannelId}>`
              );

              // Tell inviter that invitee accepted
              await interaction.followUp({
                content: `${invitee} has accepted your invite! Head over to your game channel <#${session.p1.textChannelId}>`,
                ephemeral: MessageFlags.Ephemeral,
              });
            } else if (inviteeResponse.customId === 'deny_invite') {
              // Tell invite that they've interacted with the deny button
              await inviteeResponse.update({
                content: `You've been invited by ${inviter} to play Battleship!\n❌ **Declined** You have declined the invitation.`,
                components: [disabledRow],
              });

              denySession(session);

              // Tell inviter that invitee denied
              await interaction.followUp({
                content: `${invitee} has denied your invite!`,
                ephemeral: MessageFlags.Ephemeral,
              });
            }
          } catch (error) {
            console.error('Error handling invite response:', error);
          }
        });

        collector.on('end', async (collected, reason) => {
          // Clean up collector reference
          delete session.inviteCollector;

          // Handle timeout if invite is still pending
          if (reason === 'time' && session.status === 'invite_pending') {
            expireSession(session);

            // Create disabled buttons
            const disabledRow = new ActionRowBuilder().addComponents(
              ButtonBuilder.from(accept).setDisabled(true),
              ButtonBuilder.from(deny).setDisabled(true)
            );

            try {
              // Tell invitee the invitation expired
              await dmMessage.edit({
                content: `You've been invited by ${inviter} to play Battleship!\nUnfortunately, you didn't respond in time.`,
                components: [disabledRow],
              });

              // Tell inviter the invitation expired
              await interaction.followUp({
                content: `${invitee} didn't respond to the invite in time.`,
                ephemeral: MessageFlags.Ephemeral,
              });
            } catch (error) {
              console.error('Error handling invite timeout:', error);
            }
          }
        });

        // Tell inviter invitation was sent successfully
        await interaction.reply({
          content: `Invitation sent to ${invitee}.`,
          ephemeral: MessageFlags.Ephemeral,
        });
      } catch (dmError) {
        console.error('Failed to send DM:', dmError);
        return await interaction.reply({
          content: `Could not send a DM to ${invitee}. They may have DMs disabled.`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'invite-cancel') {
      const inviter = interaction.user;
      const pendingInviteSession = sessions.find(
        // The inviter is always p1 to the pov of the current player
        (session) => session.p1.id === inviter.id && session.status === 'invite_pending'
      );

      // Check if user has pending invites
      if (!pendingInviteSession) {
        return interaction.reply({
          content: "You don't have any pending invites!",
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      const invitee = await interaction.client.users.fetch(pendingInviteSession.p2.id);

      // Stop the collector if it exists
      if (pendingInviteSession.inviteCollector) {
        pendingInviteSession.inviteCollector.stop('cancelled');
      }

      try {
        // Get DM message and disable buttons
        const { channelId: dmChannelId, messageId: dmMessageId } = pendingInviteSession.dm;
        const dmChannel = await interaction.client.channels.fetch(dmChannelId);
        const dmMessage = await dmChannel.messages.fetch(dmMessageId);

        // Create disabled buttons from existing components
        const row = ActionRowBuilder.from(dmMessage.components[0]);
        row.components = row.components.map((component) =>
          ButtonBuilder.from(component).setDisabled(true)
        );

        // Mark session as cancelled
        cancelSession(pendingInviteSession);

        // Tell invitee the invite was cancelled
        await dmMessage.edit({
          content: `You've been invited by ${inviter} to play Battleship!\n${inviter} cancelled the invitation.`,
          components: [row],
        });

        // Tell inviter the cancellation was successful
        return await interaction.reply({
          content: `Your invite to ${invitee} has been cancelled!`,
          ephemeral: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error('Error cancelling invite:', error);
        return await interaction.reply({
          content: 'Failed to cancel the invite. It may have already been responded to.',
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
