const { ChannelType, PermissionsBitField, MessageFlags } = require('discord.js');

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
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 10;

function newBoard() {
  return Array(BOARD_HEIGHT)
    .fill()
    .map(() => Array(BOARD_WIDTH).fill(0));
}

function createSession(sessions, p1, p2) {
  const newSession = {
    id: sessions.length,
    status: 'invite_pending',
    p1: {
      id: p1.id,
      board: null,
      guesses: null,
      textChannelId: null,
    },
    p2: {
      id: p2.id,
      board: null,
      guesses: null,
      textChannelId: null,
    },
    inviteTimestamp: new Date(),
    // inviteAcceptedTimestamp: null,
  };
  sessions.push(newSession);
  return newSession;
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

module.exports = {
  createSession,
  sessionInit,
  denySession,
  expireSession,
};
