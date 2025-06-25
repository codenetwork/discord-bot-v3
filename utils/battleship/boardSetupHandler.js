const { sessions } = require('./sessionManagement');
const { SEA } = require('./constants');
const {
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

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

function generateMainInterface(session, playerKey) {
  const board = playerKey === 'p1' ? session.p1.board : session.p2.board;

  const boardAsText = boardRepresentation(board);
  const boardTextDisplayComponent = new TextDisplayBuilder().setContent(
    'Your current board:\n' + boardAsText
  );

  const placeShipButton = new ButtonBuilder()
    .setCustomId('place_ship')
    .setLabel('Place Ship')
    .setEmoji('🚢')
    .setStyle(ButtonStyle.Primary);

  const removeShipButton = new ButtonBuilder()
    .setCustomId('remove_ship')
    .setLabel('Remove Ship')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(placeShipButton, removeShipButton);

  return [boardTextDisplayComponent, row];
}

// async function handleBoardSetupInteraction(interaction, session) {
//   // Massive ass switch statement
//   switch (interaction.customId.substr('battleship_'.length)) {
//     case 'place_ship':
//       console.log('PLACE SHIP BABY');

//       const textDisplayComponent = new TextDisplayBuilder().setContent(
//         '# ahh the ship HAS BEEN PLACED'
//       );

//       return interaction.reply({
//         components: [textDisplayComponent],
//         flags: MessageFlags.IsComponentsV2,
//       });
//     case 'remove_ship':
//       console.log('rmeove ship BABY');
//       break;
//     default:
//       console.log('WHAT THE IS GOING GON ODASNFOSNDFKLDJF LKASJ FLKASJFKLADSJ ');
//   }
// }

async function startBoardSetup(interaction, session) {
  const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

  const welcomeP1Component = new TextDisplayBuilder().setContent(
    // `# Welcome to Battleship!\n## You are fighting against ${invitee}`
    `# Welcome to Battleship!\n## You are fighting against <@${session.p2.id}>`
  );

  await p1Channel.send({
    components: [welcomeP1Component, ...generateMainInterface(session, 'p1')],
    flags: MessageFlags.IsComponentsV2,
  });

  const welcomeP2Component = new TextDisplayBuilder().setContent(
    `# Welcome to Battleship!\n## You are fighting against <@${session.p1.id}>`
  );

  await p2Channel.send({
    components: [welcomeP2Component, ...generateMainInterface(session, 'p2')],
    flags: MessageFlags.IsComponentsV2,
  });

  createPlayerCollector(p1Channel, session, 'p1');
  createPlayerCollector(p2Channel, session, 'p2');
}

function createPlayerCollector(channel, session, playerKey) {
  const playerId = playerKey === 'p1' ? session.p1.id : session.p2.id;
  const collector = channel.createMessageComponentCollector({
    filter: (i) => i.user.id === playerId,
    // time: 300_000, // 5 minutes
    time: 10_000, // 10 seconds
  });

  collector.on('collect', async (interaction) => {
    const { currentInterface } = playerKey === 'p1' ? session.p1.boardSetup : session.p2.boardSetup;

    if (currentInterface === 'main') {
      await handleMainInterfaceClick(interaction, session, playerKey);
    } /*else if (currentInterface === 'placing') {
      await handlePlacingInterfaceClick();
    } else if (currentInterface === 'removing') {
      await handleRemovingInterfaceClick();
    }*/
  });

  collector.on('end', async (collected) => {
    // TODO: make user unable to do shit once timed out lol
    await channel.send({ content: 'nigga timed out' });
  });
}

async function handleMainInterfaceClick(interaction, session, playerKey) {
  if (interaction.customId === 'place_ship') {
    console.log('PLACE SHIP BABY');

    const textDisplayComponent = new TextDisplayBuilder().setContent(
      '# ahh the ship HAS BEEN PLACED'
    );

    return interaction.reply({
      components: [textDisplayComponent],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

module.exports = {
  findSessionByChannel,
  startBoardSetup,
};
