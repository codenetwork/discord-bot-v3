const { sessions } = require('./sessionManagement');
const { SEA } = require('./constants');
const { TextDisplayBuilder } = require('discord.js');

function findSessionByChannel(channelId) {
  return sessions.find(
    (session) => session.p1.textChannelId === channelId || session.p2.textChannelId === channelId
  );
}

function boardRepresentation(board) {
  const parts = ['```\n'];
  const width = board[0].length;
  const height = board.length;

  // Column headers
  parts.push('    ');
  for (let i = 1; i <= width; i++) {
    if (i < 10) {
      parts.push(`${i}   `);
    } else {
      parts.push(`${i}  `);
    }
  }
  parts.push('\n');

  // Top border
  parts.push('  ┌');
  for (let i = 0; i < width; i++) {
    parts.push('───');
    if (i < width - 1) {
      parts.push('┬');
    }
  }
  parts.push('┐\n');

  // Board rows
  board.forEach((row, idx) => {
    const asciiValA = 'A'.charCodeAt(0);
    const rowChar = String.fromCharCode(asciiValA + idx);

    // Row content
    parts.push(`${rowChar} │`);
    row.forEach((cell) => {
      let icon = cell === SEA ? '≈' : '⚓';
      parts.push(` ${icon} │`);
    });
    parts.push('\n');

    // Row separator (except for last row)
    if (idx < height - 1) {
      parts.push('  ├');
      for (let i = 0; i < width; i++) {
        parts.push('───');
        if (i < width - 1) {
          parts.push('┼');
        }
      }
      parts.push('┤\n');
    }
  });

  // Bottom border
  parts.push('  └');
  for (let i = 0; i < width; i++) {
    parts.push('───');
    if (i < width - 1) {
      parts.push('┴');
    }
  }
  parts.push('┘\n```');

  return parts.join('');
}

function generateMainInterface(session, player) {
  const board = player === 'p1' ? session.p1.board : session.p2.board;

  const boardAsText = boardRepresentation(board);

  const boardTextDisplayComponent = new TextDisplayBuilder().setContent(
    'Your current board:\n' + boardAsText
  );

  return [boardTextDisplayComponent];
}

async function handleBoardSetupInteraction(interaction, session) {
  // Massive ass switch statement
  switch (interaction.customId) {
  }
}

module.exports = {
  findSessionByChannel,
  handleBoardSetupInteraction,
  generateMainInterface,
};
