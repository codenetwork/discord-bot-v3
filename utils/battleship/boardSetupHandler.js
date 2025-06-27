const {
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} = require('discord.js');
const { SEA, BOARD_HEIGHT, BOARD_WIDTH } = require('./constants');
const { startIdleTimer, resetIdleTimer } = require('./sessionManagement');

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

function isPlacementValid(session, playerKey) {
  const { board, boardSetup } = session[playerKey];

  const { selectedShip, selectedOrientation, selectedRow, selectedColumn } = boardSetup;

  // If any of the selections are incomplete
  if (!selectedShip || !selectedOrientation || !selectedRow || !selectedColumn) {
    return false;
  }

  const { length: shipLength } = selectedShip;
  const colIdx = selectedColumn - 1; // column in indexes
  const rowIdx = selectedRow.charCodeAt(0) - 'A'.charCodeAt(0); // row in indexes

  // Ensure that the ship doesn't go over the board and is not overlapping
  // any other ships
  if (selectedOrientation === 'Horizontal') {
    if (colIdx + shipLength > BOARD_WIDTH) return false;

    for (let i = 0; i < shipLength; i++) {
      if (board[rowIdx][colIdx + i] !== SEA) {
        return false;
      }
    }
  } else {
    if (rowIdx + shipLength > BOARD_HEIGHT) return false;

    for (let i = 0; i < shipLength; i++) {
      if (board[rowIdx + i][colIdx] !== SEA) {
        return false;
      }
    }
  }

  return true;
}

function generateShipPlacementBoard(session, playerKey) {
  const { board, boardSetup } = session[playerKey];
  const { selectedShip, selectedOrientation, selectedRow, selectedColumn } = boardSetup;

  const { id: shipId, length: shipLength } = selectedShip;
  const colIdx = selectedColumn - 1; // column in indexes
  const rowIdx = selectedRow.charCodeAt(0) - 'A'.charCodeAt(0); // row in indexes

  const isHorizontal = selectedOrientation === 'Horizontal';
  const colInc = isHorizontal ? 1 : 0;
  const rowInc = isHorizontal ? 0 : 1;

  const boardCopy = structuredClone(board);
  for (let i = 0; i < shipLength; i++) {
    boardCopy[rowIdx + i * rowInc][colIdx + i * colInc] = shipId;
  }

  return boardCopy;
}

async function sendPlacementFeedback(interaction, session, playerKey) {
  const { boardSetup } = session[playerKey];

  const { selectedShip, selectedOrientation, selectedRow, selectedColumn } = boardSetup;

  // If any of the selections are incomplete
  if (!selectedShip || !selectedOrientation || !selectedRow || !selectedColumn) {
    return;
  }

  // Delete previous button message if it exists
  if (boardSetup.placementFeedbackMessageId) {
    try {
      const oldMessage = await interaction.channel.messages.fetch(
        boardSetup.placementFeedbackMessageId
      );
      await oldMessage.delete();
    } catch (error) {
      // Message might already be deleted, ignore error
    }
  }

  // Send a message saying whether their placement was valid or not
  // If it's valid, a place button is sent
  // If it's not valid, a simple message telling why it's invalid is sent
  if (isPlacementValid(session, playerKey)) {
    const boardWithPlacedShip = generateShipPlacementBoard(session, playerKey);
    const updatedBoardText = boardRepresentation(boardWithPlacedShip);
    const updatedBoardTextDisplay = new TextDisplayBuilder().setContent(
      'This is what your board will look like:' + updatedBoardText + '\nClick below to confirm:'
    );

    const placeButton = new ButtonBuilder()
      .setCustomId('confirm_place_ship_button')
      .setLabel('🎯 Place Ship!')
      .setStyle(ButtonStyle.Success);
    const actionRow = new ActionRowBuilder().addComponents(placeButton);

    const placeButtonMessage = await interaction.followUp({
      components: [updatedBoardTextDisplay, actionRow],
      flags: MessageFlags.IsComponentsV2,
    });

    boardSetup.placementFeedbackMessageId = placeButtonMessage.id;

    const playerObj = session[playerKey];
    if (playerObj.collectors.placementFeedbackCollector) {
      playerObj.collectors.placementFeedbackCollector.stop();
    }
    playerObj.collectors.placementFeedbackCollector = createPlayerCollector(
      placeButtonMessage,
      session,
      playerKey
    );
  } else {
    const invalidPlacementTextDisplay = new TextDisplayBuilder().setContent(
      'Your placement selection is invalid, please change your selections!'
    );

    const invalidPlacementMessage = await interaction.followUp({
      components: [invalidPlacementTextDisplay],
      flags: MessageFlags.IsComponentsV2,
    });

    boardSetup.placementFeedbackMessageId = invalidPlacementMessage.id;
  }
}

function generateMainInterface(session, playerKey) {
  const board = session[playerKey].board;

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
  const playerObj = session[playerKey];

  const titleTextDisplay = new TextDisplayBuilder().setContent(
    '# Place a ship!\nWhat your board currently looks like:'
  );

  const boardTextDisplay = new TextDisplayBuilder().setContent(
    boardRepresentation(playerObj.board)
  );

  const separator = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large);

  const shipSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('ship_select_menu')
    .setPlaceholder('Select a ship!')
    .addOptions(
      playerObj.boardSetup.ships
        .filter((ship) => !ship.placed)
        .map((ship) => {
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${ship.name} (length ${ship.length})`)
            .setEmoji(ship.emoji)
            .setValue(ship.name.toLowerCase());
        })
    );
  const shipActionRow = new ActionRowBuilder().addComponents(shipSelectMenu);

  const orientationSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('orientation_select_menu')
    .setPlaceholder('Select an orientation!')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Horizontal').setValue('Horizontal'),
      new StringSelectMenuOptionBuilder().setLabel('Vertical').setValue('Vertical')
    );
  const orientationActionRow = new ActionRowBuilder().addComponents(orientationSelectMenu);

  const rowOptions = [];
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    const asciiValA = 'A'.charCodeAt(0);
    const rowChar = String.fromCharCode(asciiValA + row);
    const rowSelectMenuOption = new StringSelectMenuOptionBuilder()
      .setLabel(rowChar)
      .setValue(rowChar);
    rowOptions.push(rowSelectMenuOption);
  }
  const rowSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('row_select_menu')
    .setPlaceholder('Select a row!')
    .addOptions(rowOptions);
  const rowActionRow = new ActionRowBuilder().addComponents(rowSelectMenu);

  const colOptions = [];
  for (let col = 1; col <= BOARD_WIDTH; col++) {
    const colSelectMenuOption = new StringSelectMenuOptionBuilder()
      .setLabel(`${col}`)
      .setValue(`${col}`);
    colOptions.push(colSelectMenuOption);
  }
  const colSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('col_select_menu')
    .setPlaceholder('Select a column!')
    .addOptions(colOptions);
  const colActionRow = new ActionRowBuilder().addComponents(colSelectMenu);

  return [
    titleTextDisplay,
    boardTextDisplay,
    separator,
    shipActionRow,
    orientationActionRow,
    rowActionRow,
    colActionRow,
  ];
}

function createPlayerCollector(message, session, playerKey) {
  const playerId = session[playerKey].id;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === playerId,
    time: 300_000, // 5 minutes
  });

  collector.on('collect', async (interaction) => {
    const { currentInterface } = session[playerKey].boardSetup;
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

  // collector.on('end', async (collected, reason) => {
  //   // TODO: make user unable to do shit once timed out lol
  //   if (reason === 'time') await message.channel.send({ content: `timed out from ${message.id}` });
  //   console.log(reason);
  // });

  collector.on('end', async (collected, reason) => {
    const playerObj = session[playerKey];
    // Remove the collector reference when it ends
    Object.keys(playerObj.collectors).forEach((key) => {
      if (playerObj.collectors[key] === collector) {
        delete playerObj.collectors[key];
      }
    });
    console.log(`Collector ended: ${reason}`);
  });

  return collector;
}

async function startBoardSetup(interaction, session) {
  const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

  const welcomeP1Component = new TextDisplayBuilder().setContent(
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

  session.p1.collectors.currentInterfaceCollector = createPlayerCollector(p1Message, session, 'p1');
  session.p2.collectors.currentInterfaceCollector = createPlayerCollector(p2Message, session, 'p2');

  startIdleTimer(p1Channel, session, 'p1');
  startIdleTimer(p2Channel, session, 'p2');
}

async function startPlacingFlow(interaction, session, playerKey) {
  // Acknowledge "Place Ship" pressed immediately
  await interaction.reply('Opening ship placement...');

  const placeInterfaceMessage = await interaction.channel.send({
    components: generatePlacingInterface(session, playerKey),
    flags: MessageFlags.IsComponentsV2,
  });

  // console.log('Just finished generatingPlaceInterface()');

  const playerObj = session[playerKey];

  if (playerObj.collectors.currentInterfaceCollector) {
    playerObj.collectors.currentInterfaceCollector.stop();
  }

  playerObj.collectors.currentInterfaceCollector = createPlayerCollector(
    placeInterfaceMessage,
    session,
    playerKey
  );
}

async function handleMainInterfaceClick(interaction, session, playerKey) {
  resetIdleTimer(interaction.channel, session, playerKey);
  const { boardSetup } = session[playerKey];
  if (interaction.customId === 'place_ship') {
    console.log('PLACE SHIP BABY');
    boardSetup.currentInterface = 'placing';
    console.log(`currentInterface is now: ${boardSetup.currentInterface}`);
    await startPlacingFlow(interaction, session, playerKey);
  }
}

async function handlePlacingInterfaceClick(interaction, session, playerKey) {
  resetIdleTimer(interaction.channel, session, playerKey);
  console.log(interaction.customId);
  const { boardSetup } = session[playerKey];

  switch (interaction.customId) {
    case 'ship_select_menu':
      const selectedShipName = interaction.values[0];

      const shipObj = boardSetup.ships.find((ship) => ship.name.toLowerCase() === selectedShipName);
      boardSetup.selectedShip = shipObj;

      await interaction.deferUpdate();
      await sendPlacementFeedback(interaction, session, playerKey);
      break;
    case 'orientation_select_menu':
      const selectedOrientation = interaction.values[0];
      boardSetup.selectedOrientation = selectedOrientation;

      await interaction.deferUpdate();
      await sendPlacementFeedback(interaction, session, playerKey);
      break;
    case 'row_select_menu':
      const selectedRow = interaction.values[0];
      boardSetup.selectedRow = selectedRow;

      await interaction.deferUpdate();
      await sendPlacementFeedback(interaction, session, playerKey);
      break;
    case 'col_select_menu':
      const selectedColumn = interaction.values[0];
      boardSetup.selectedColumn = parseInt(selectedColumn);

      await interaction.deferUpdate();
      await sendPlacementFeedback(interaction, session, playerKey);
      break;

    case 'confirm_place_ship_button':
      const boardWithPlacedShip = generateShipPlacementBoard(session, playerKey);

      // Place ship
      const playerObj = session[playerKey];
      playerObj.board = boardWithPlacedShip;

      const selectedShipFromShips = boardSetup.ships.find(
        (ship) => ship.id === boardSetup.selectedShip.id
      );
      selectedShipFromShips.placed = true;

      boardSetup.selectedShip = null;
      boardSetup.selectedOrientation = null;
      boardSetup.selectedRow = null;
      boardSetup.selectedColumn = null;
      boardSetup.currentInterface = 'main';

      console.log("in handle placing interface(), at 'confirm_place_ship_button'");

      await interaction.reply('ship placed ahh');
      const mainInterfaceMessage = await interaction.channel.send({
        components: generateMainInterface(session, playerKey),
        flags: MessageFlags.IsComponentsV2,
      });

      if (playerObj.collectors.placementFeedbackCollector) {
        playerObj.collectors.placementFeedbackCollector.stop();
      }

      if (playerObj.collectors.currentInterfaceCollector) {
        playerObj.collectors.currentInterfaceCollector.stop();
      }

      playerObj.collectors.currentInterfaceCollector = createPlayerCollector(
        mainInterfaceMessage,
        session,
        playerKey
      );
      break;
    default:
      console.log(`Nahh, wtf is this interaction.customId: ${interaction.customId}`);
      break;
  }

  console.log(boardSetup);
}

module.exports = {
  startBoardSetup,
};
