const { sessions } = require('./sessionManagement');
const { SEA } = require('./constants');
const {
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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

function generatePlacingInterface(session, playerKey) {
  const player = playerKey === 'p1' ? session.p1 : session.p2;

  const boardTextDisplayComponent = new TextDisplayBuilder().setContent(
    boardRepresentation(player.board)
  );

  const shipSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('ship_select_menu')
    .setPlaceholder('Select a ship!')
    .addOptions(
      ...player.boardSetup.ships
        .filter((ship) => !ship.placed)
        .map((ship) => {
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${ship.name} (length ${ship.length})`)
            .setEmoji(ship.emoji)
            .setValue(ship.name.toLowerCase());
        })
    );

  const actionRow = new ActionRowBuilder().addComponents(shipSelectMenu);

  // return [boardTextDisplayComponent, shipSelectMenu];
  return [boardTextDisplayComponent, actionRow];
}

function createPlayerCollector(message, session, playerKey) {
  const playerId = playerKey === 'p1' ? session.p1.id : session.p2.id;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === playerId,
    time: 300_000, // 5 minutes
  });

  collector.on('collect', async (interaction) => {
    const { currentInterface } = playerKey === 'p1' ? session.p1.boardSetup : session.p2.boardSetup;
    console.log(currentInterface);

    if (currentInterface === 'main') {
      console.log("Nigga i'm at main");
      await handleMainInterfaceClick(interaction, session, playerKey);
    } else if (currentInterface === 'placing') {
      console.log("Nigga i'm at placing");
      await handlePlacingInterfaceClick(interaction, session, playerKey);
    } /*else if (ace === 'removing') {
      await handleRemovingInterfaceClick();
    }*/
  });

  collector.on('end', async (collected) => {
    // TODO: make user unable to do shit once timed out lol
    await message.channel.send({ content: 'nigga timed out' });
  });
}

async function startBoardSetup(interaction, session) {
  const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

  const welcomeP1Component = new TextDisplayBuilder().setContent(
    // `# Welcome to Battleship!\n## You are fighting against ${invitee}`
    `# Welcome to Battleship!\n## You are fighting against <@${session.p2.id}>`
  );

  const p1Message = await p1Channel.send({
    components: [welcomeP1Component, ...generateMainInterface(session, 'p1')],
    flags: MessageFlags.IsComponentsV2,
  });

  const welcomeP2Component = new TextDisplayBuilder().setContent(
    `# Welcome to Battleship!\n## You are fighting against <@${session.p1.id}>`
  );

  const p2Message = await p2Channel.send({
    components: [welcomeP2Component, ...generateMainInterface(session, 'p2')],
    flags: MessageFlags.IsComponentsV2,
  });

  createPlayerCollector(p1Message, session, 'p1');
  createPlayerCollector(p2Message, session, 'p2');
}

async function startPlacingFlow(interaction, session, playerKey) {
  // Acknowledge "Place Ship" pressed immediately
  await interaction.reply('Opening ship placement...');

  const textDisplayComponent = new TextDisplayBuilder().setContent(
    '# Place a ship!\nWhat your board currently looks like:'
  );

  const placeInterfaceMessage = await interaction.channel.send({
    components: [textDisplayComponent, ...generatePlacingInterface(session, playerKey)],
    flags: MessageFlags.IsComponentsV2,
  });

  console.log('Just finished generatingPlaceInterface()');

  createPlayerCollector(placeInterfaceMessage, session, playerKey);
}

async function handleMainInterfaceClick(interaction, session, playerKey) {
  const { boardSetup } = playerKey === 'p1' ? session.p1 : session.p2;
  if (interaction.customId === 'place_ship') {
    console.log('PLACE SHIP BABY');
    boardSetup.currentInterface = 'placing';
    console.log(`currentInterface is now: ${boardSetup.currentInterface}`);
    // console.log("p1's boardSetup from session is now:");
    // console.log(session.p1.boardSetup);
    // console.log("p2's boardSetup from session is now:");
    // console.log(session.p2.boardSetup);
    await startPlacingFlow(interaction, session, playerKey);
  }
}

async function handlePlacingInterfaceClick(interaction, session, playerKey) {
  console.log('in handlePlacingInterfaceClick()');
  console.log(interaction.customId);
  if (interaction.customId === 'ship_select_menu') {
    await interaction.reply({
      content: `Nigga you selected ${interaction.values[0]}`,
    });
  }
}

module.exports = {
  findSessionByChannel,
  startBoardSetup,
};
