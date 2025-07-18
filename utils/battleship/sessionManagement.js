const { ChannelType, PermissionsBitField, MessageFlags } = require('discord.js');
const { BOARD_HEIGHT, BOARD_WIDTH, SEA, SHIPS, TIMEOUT_IDLE } = require('./constants');

const sessions = [];

async function isInviteValid(interaction, inviter, invitee) {
  // Check if the inviter is already in an active session
  const activeStatuses = ['invite_pending', 'board_setup', 'game_phase'];
  const inviterActiveSession = sessions.find(
    (session) => session.p1.id === inviter.id && activeStatuses.includes(session.status)
  );
  if (inviterActiveSession) {
    await interaction.reply({
      content:
        'You already have an active game or pending invite. Either finish your game or cancel your invite before inviting another player.',
      ephemeral: MessageFlags.Ephemeral,
    });
    return false;
  }

  // Check if the invitee is in an active session
  const inviteeActiveSession = sessions.find(
    (session) => session.p1.id === invitee.id && activeStatuses.includes(session.status)
  );
  if (inviteeActiveSession) {
    await interaction.reply({
      content: `${invitee} either has an active invite or is currently in a game. Tell them to cancel their invite or finish their game!`,
      ephemeral: MessageFlags.Ephemeral,
    });
    return false;
  }

  // Check if inviter is already invited by someone
  const inviterIsInvitedSession = sessions.find(
    (session) => session.status === 'invite_pending' && session.p2.id === inviter.id
  );
  if (inviterIsInvitedSession) {
    await interaction.reply({
      content: 'You are invited by someone, check your DMs and respond to them first!',
      ephemeral: MessageFlags.Ephemeral,
    });
    return false;
  }

  // Check if invitee is already invited by someone
  const inviteeIsInvitedSession = sessions.find(
    (session) => session.status === 'invite_pending' && session.p2.id === invitee.id
  );
  if (inviteeIsInvitedSession) {
    await interaction.reply({
      content: `${invitee} is being invited by someone else. Unfortunately, they would have to respond to their invite first.`,
      ephemeral: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}

function newBoard() {
  return Array(BOARD_HEIGHT)
    .fill()
    .map(() => Array(BOARD_WIDTH).fill(SEA));
}

function newPlayerObj(player) {
  return {
    id: player.id,
    board: null,
    guesses: null,
    moves: [],
    textChannelId: null,
    idleTimer: null,
    boardSetup: {
      currentInterface: null,
      ships: null,
      selectedShip: null,
      selectedOrientation: null,
      selectedRow: null,
      selectedColumn: null,
      placementFeedbackMessageId: null,
      selectedRemoveShip: null,
      removalFeedbackMessageId: null,
      hasFinishedSetup: false,
    },
    collectors: {},
  };
}

function createSession(p1, p2) {
  const id = sessions.length;
  const newSession = {
    id,
    status: 'invite_pending',
    p1: newPlayerObj(p1),
    p2: newPlayerObj(p2),
    inviteTimestamp: new Date(),
    inviteAcceptedTimestamp: null,
  };
  sessions.push(newSession);
  console.log(`Session ${id} - Invite Sent`);
  return newSession;
}

function createGamePhaseInSession(session) {
  const randomTurn = Math.floor(Math.random() * 2) === 0 ? 'p1' : 'p2';
  session.gamePhase = {
    turn: randomTurn,
    selectedRow: null,
    selectedColumn: null,
  };
  session.status = 'game_phase';
}

async function sessionInit(interaction, session, p1, p2) {
  // Find Battleship category
  let battleshipCategory = interaction.guild.channels.cache.find(
    (channel) => channel.name === 'Battleship' && channel.type === ChannelType.GuildCategory
  );

  // Create Battleship category if it doesn't exist
  if (!battleshipCategory) {
    try {
      battleshipCategory = await interaction.guild.channels.create({
        name: 'Battleship',
        type: ChannelType.GuildCategory,
      });
    } catch (error) {
      console.error('Failed in creating Battleship category:', error);
      return interaction.reply({
        content: 'Failed to create Battleship category.',
        ephemeral: MessageFlags.Ephemeral,
      });
    }
  }

  // Create p1's text channel
  const p1Channel = await interaction.guild.channels.create({
    name: `bs-${session.id}-${p1.username}`,
    type: ChannelType.GuildText,
    parent: battleshipCategory.id,
    permissionOverwrites: [
      {
        id: p1.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
      },
      {
        id: p2.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
    ],
  });

  // Create p2's text channel
  const p2Channel = await interaction.guild.channels.create({
    name: `bs-${session.id}-${p2.username}`,
    type: ChannelType.GuildText,
    parent: battleshipCategory.id,
    permissionOverwrites: [
      {
        id: p2.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
      },
      {
        id: p1.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
    ],
  });

  // Mark the sessions' text channels
  session.p1.textChannelId = p1Channel.id;
  session.p2.textChannelId = p2Channel.id;

  // Boards
  session.p1.board = newBoard();
  session.p1.guesses = newBoard();
  session.p2.board = newBoard();
  session.p2.guesses = newBoard();

  // Board setups
  session.p1.boardSetup.currentInterface = 'main';
  session.p2.boardSetup.currentInterface = 'main';
  session.p1.boardSetup.ships = SHIPS.map((ship) => ({ ...ship, placed: false }));
  session.p2.boardSetup.ships = SHIPS.map((ship) => ({ ...ship, placed: false }));

  // Mark time accepted
  session.inviteAcceptedTimestamp = new Date();

  // Change status
  session.status = 'board_setup';

  console.log(`Session ${session.id} - Invite Accepted`);
}

function denySession(session) {
  session.inviteDeniedTimestamp = new Date();
  session.status = 'invite_denied';
  console.log(`Session ${session.id} - Invite Denied`);
}

function expireSession(session) {
  session.inviteExpiredTimestamp = new Date();
  session.status = 'invite_expired';
  console.log(`Session ${session.id} - Invite Expired`);
}

function cancelSession(session) {
  session.inviteCancelledTimestamp = new Date();
  session.status = 'invite_cancelled';
  console.log(`Session ${session.id} - Invite Cancelled`);
}

function startIdleTimer(channel, session, playerKey) {
  const playerObj = session[playerKey];

  if (playerObj.idleTimer) {
    clearTimeout(playerObj.idleTimer);
  }

  playerObj.idleTimer = setTimeout(() => {
    handlePlayerTimeout(channel, session, playerKey);
  }, TIMEOUT_IDLE);
}

function resetIdleTimer(channel, session, playerKey) {
  // Simply start again
  startIdleTimer(channel, session, playerKey);
}

function stopCollectors(session, playerKey, stopReason = 'all_collectors_stopped') {
  const { collectors } = session[playerKey];
  Object.values(collectors).forEach((collector) => {
    if (!collector.ended) {
      collector.stop(stopReason);
    }
  });
  session[playerKey].collectors = {};
}

function stopIdleTimer(session, playerKey) {
  const playerObj = session[playerKey];
  if (playerObj.idleTimer) {
    clearTimeout(playerObj.idleTimer);
    playerObj.idleTimer = null;
  }

  stopCollectors(session, playerKey);
}

function finishSession(session, status = null) {
  stopIdleTimer(session, 'p1');
  stopIdleTimer(session, 'p2');

  if (status !== null) {
    session.status = status;
  }
}

function winnerSession(session, playerKey) {
  finishSession(session, `${playerKey}_win`);
  console.log(`Session ${session.id} - ${playerKey.toUpperCase()} Win`);
}

async function sessionChannelsViewOnly(session, client) {
  const p1Channel = await client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await client.channels.fetch(session.p2.textChannelId);
  const everyoneId = p1Channel.guildId;

  // Make channels view only
  const viewOnlyPermission = {
    ViewChannel: true,
    SendMessages: false,
    AddReactions: false,
  };
  await p1Channel.permissionOverwrites.edit(everyoneId, viewOnlyPermission);
  await p2Channel.permissionOverwrites.edit(everyoneId, viewOnlyPermission);

  // Overwrite p1 and p2's permissions to respective channels
  await p1Channel.permissionOverwrites.edit(session.p1.id, viewOnlyPermission);
  await p1Channel.permissionOverwrites.edit(session.p2.id, viewOnlyPermission);
  await p2Channel.permissionOverwrites.edit(session.p2.id, viewOnlyPermission);
  await p2Channel.permissionOverwrites.edit(session.p1.id, viewOnlyPermission);
}

async function handlePlayerTimeout(channel, session, playerKey) {
  // Player went idle for 5 minutes
  finishSession(session, `${playerKey}_idle_timeout`);

  const opponentKey = playerKey === 'p1' ? 'p2' : 'p1';
  const opponentChannelId = session[opponentKey].textChannelId;

  // Send timeout message to current player
  await channel.send('⏰ You went idle for too long. Game session ended.');

  const opponentChannel = await channel.client.channels.fetch(opponentChannelId);
  await opponentChannel.send('⏰ Your opponent went idle for too long. Game session ended.');

  // Make channels view only
  await sessionChannelsViewOnly(session, channel.client);

  console.log(`Session ${session.id} - Timed out ${playerKey}`);
}

module.exports = {
  isInviteValid,
  createSession,
  sessionInit,
  denySession,
  expireSession,
  cancelSession,
  sessions,
  startIdleTimer,
  resetIdleTimer,
  stopIdleTimer,
  createGamePhaseInSession,
  finishSession,
  winnerSession,
  sessionChannelsViewOnly,
};
