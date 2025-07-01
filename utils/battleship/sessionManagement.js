const { ChannelType, PermissionsBitField, MessageFlags } = require('discord.js');
const { BOARD_HEIGHT, BOARD_WIDTH, SEA, SHIPS } = require('./constants');

const sessions = [];

/**
 * `sessions` type (per item)
 * session:
 *  {
 *    id: int
 *    status: "invite_pending", "invite_expired", "invite_denied", "board_setup", "turn_p1", "turn_p2", "finish_p1_win", "finish_p2_win",
 *    p1:
 *     {
 *       id: Member.id,
 *       board: [n x m],
 *       guesses: [n x m],
 *       textChannelId: Channel.id
 *     },
 *    p2:
 *     {
 *       id: Member.id,
 *       board: [n x m],
 *       guesses: [n x m],
 *       textChannelId: Channel.id
 *     },
 *    inviteTimestamp: Date,
 *    inviteAcceptedTimestamp: Date
 *  }
 *
 */

async function isInviteValid(interaction, inviter, invitee) {
  // Check if the inviter is already in an active session
  const activeStatuses = ['invite_pending', 'board_setup', 'turn_p1', 'turn_p2'];
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
    },
    collectors: {},
  };
}

function createSession(p1, p2) {
  const newSession = {
    id: sessions.length,
    status: 'invite_pending',
    p1: newPlayerObj(p1),
    p2: newPlayerObj(p2),
    inviteTimestamp: new Date(),
    // inviteAcceptedTimestamp: null,
  };
  sessions.push(newSession);
  return newSession;
}

function createGamePhaseInSession(session) {
  const randomTurn = Math.floor(Math.random() * 2) === 0 ? 'p1' : 'p2';
  session.gamePhase = {
    turn: randomTurn,
    selectedRow: null,
    selectedColumn: null,
  };
}

async function sessionInit(interaction, session, p1, p2) {
  console.log('session init!');
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

  console.log('woah!');
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

  console.log('New Session created!');
  console.log(session);
}

function denySession(session) {
  session.inviteDeniedTimestamp = new Date();
  session.status = 'invite_denied';

  console.log('Session denied!');
  console.log(session);
}

function expireSession(session) {
  session.inviteExpiredTimestamp = new Date();
  session.status = 'invite_expired';

  console.log('Session expired!');
  console.log(session);
}

function cancelSession(session) {
  session.inviteCancelledTimestamp = new Date();
  session.status = 'invite_cancelled';

  console.log('Session cancelled!');
  console.log(session);
}

function startIdleTimer(channel, session, playerKey) {
  const playerObj = session[playerKey];

  if (playerObj.idleTimer) {
    clearTimeout(playerObj.idleTimer);
  }

  playerObj.idleTimer = setTimeout(() => {
    handlePlayerTimeout(channel, session, playerKey);
  }, 300_000); // 5 minutes
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
  session.collectors = {};
}

function stopIdleTimer(session, playerKey) {
  // Stop idle timer
  const { idleTimer } = session[playerKey];
  if (idleTimer) {
    clearTimeout(idleTimer);
  }

  stopCollectors(session, playerKey);
}

async function handlePlayerTimeout(channel, session, playerKey) {
  // Player went idle for 5 minutes
  session.status = `${playerKey}_idle_timeout`;

  // Stop their current collector
  // const playerObj = playerKey === 'p1' ? session.p1 : session.p2;
  // if (playerObj.currentCollector) {
  //   playerObj.currentCollector.stop('idle_timeout');
  // }

  stopCollectors(session, playerKey, 'idle_timeout');
  // const playerObj = session[playerKey];
  // if (playerObj.collectors) {
  //   // Stop all collectors in the collectors object
  //   Object.keys(playerObj.collectors).forEach((collectorKey) => {
  //     const collector = playerObj.collectors[collectorKey];
  //     if (collector && !collector.ended) {
  //       collector.stop('timeout');
  //     }
  //   });

  //   // Clear the collectors object
  //   playerObj.collectors = {};
  // }

  // Send timeout message
  await channel.send('⏰ You went idle for too long. Game session ended.');
  console.log('FROM handlePlayerTimeout() NIGGA');
  console.log(session);
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
};
