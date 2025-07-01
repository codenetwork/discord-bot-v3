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
const { SEA, SEA_ICON, SHIPS, BOARD_HEIGHT, BOARD_WIDTH } = require('./constants');
const { startIdleTimer, resetIdleTimer, stopIdleTimer } = require('./sessionManagement');
const { createCollector } = require('./interactionHandlers');
const { startGamePhase } = require('./gamePhase');

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
      const icon = SHIPS.find((ship) => ship.id === cell)?.icon || SEA_ICON;
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

function generateShipRemovalBoard(session, playerKey) {
  const { board, boardSetup } = session[playerKey];
  const { selectedRemoveShip } = boardSetup;
  const { id: removeShipId } = selectedRemoveShip;

  // Delete ship by iterating every cell
  const boardCopy = structuredClone(board);
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      if (boardCopy[i][j] === removeShipId) {
        boardCopy[i][j] = SEA;
      }
    }
  }

  return boardCopy;
}

function generateMainInterface(session, playerKey) {
  const board = session[playerKey].board;

  const boardAsText = boardRepresentation(board);
  const boardTextDisplayComponent = new TextDisplayBuilder().setContent(
    'Your current board:\n' + boardAsText
  );

  // Create place ship button
  const placeShipButton = new ButtonBuilder()
    .setCustomId('place_ship_button')
    .setLabel('Place Ship')
    .setEmoji('🚢')
    .setStyle(ButtonStyle.Primary);

  // Create remove ship button
  const removeShipButton = new ButtonBuilder()
    .setCustomId('remove_ship_button')
    .setLabel('Remove Ship')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Primary);

  const actionRow = new ActionRowBuilder().addComponents(placeShipButton, removeShipButton);

  // Create finish setup button if all ships have been placed
  const allShipsPlaced = session[playerKey].boardSetup.ships.every((ship) => ship.placed);
  if (allShipsPlaced) {
    const finishSetupButton = new ButtonBuilder()
      .setCustomId('finish_setup_button')
      .setLabel('Finish Setup')
      .setEmoji('🏁')
      .setStyle(ButtonStyle.Success);
    actionRow.addComponents(finishSetupButton);
  }

  return [boardTextDisplayComponent, actionRow];
}

function generatePlacingInterface(session, playerKey) {
  const { board, boardSetup } = session[playerKey];

  // Create title text display
  const titleTextDisplay = new TextDisplayBuilder().setContent(
    '# Place a ship!\nWhat your board currently looks like:'
  );

  // Create board text display
  const boardTextDisplay = new TextDisplayBuilder().setContent(boardRepresentation(board));

  // Create separator
  const separator = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large);

  // Create ship select menu
  const availableShips = boardSetup.ships.filter((ship) => !ship.placed);
  const shipSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('ship_select_menu')
    .setPlaceholder('Select a ship!')
    .addOptions(
      availableShips.map((ship) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${ship.icon} ${ship.name} (length ${ship.length})`)
          .setEmoji(ship.emoji)
          .setValue(ship.name.toLowerCase())
      )
    );
  const shipActionRow = new ActionRowBuilder().addComponents(shipSelectMenu);

  // Create orientation select menu
  const orientationSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('orientation_select_menu')
    .setPlaceholder('Select an orientation!')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Horizontal').setValue('Horizontal'),
      new StringSelectMenuOptionBuilder().setLabel('Vertical').setValue('Vertical')
    );
  const orientationActionRow = new ActionRowBuilder().addComponents(orientationSelectMenu);

  // Create row select menu
  const rowSelectMenuOptions = [];
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    const asciiValA = 'A'.charCodeAt(0);
    const rowChar = String.fromCharCode(asciiValA + row);
    const rowSelectMenuOption = new StringSelectMenuOptionBuilder()
      .setLabel(rowChar)
      .setValue(rowChar);
    rowSelectMenuOptions.push(rowSelectMenuOption);
  }
  const rowSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('row_select_menu')
    .setPlaceholder('Select a row!')
    .addOptions(rowSelectMenuOptions);
  const rowActionRow = new ActionRowBuilder().addComponents(rowSelectMenu);

  // Create column select menu
  const colSelectMenuOptions = [];
  for (let col = 1; col <= BOARD_WIDTH; col++) {
    const colSelectMenuOption = new StringSelectMenuOptionBuilder()
      .setLabel(`${col}`)
      .setValue(`${col}`);
    colSelectMenuOptions.push(colSelectMenuOption);
  }
  const colSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('col_select_menu')
    .setPlaceholder('Select a column!')
    .addOptions(colSelectMenuOptions);
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

function generateRemovingInterface(session, playerKey) {
  const { board, boardSetup } = session[playerKey];

  // Create title text display
  const titleTextDisplay = new TextDisplayBuilder().setContent(
    '# Remove a ship!\nWhat your board currently looks like:'
  );

  // Create board text display
  const boardTextDisplay = new TextDisplayBuilder().setContent(boardRepresentation(board));

  // Create remove ship select menu
  const placedShips = boardSetup.ships.filter((ship) => ship.placed);
  const removeShipSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('remove_ship_select_menu')
    .setPlaceholder('Remove a ship!')
    .addOptions(
      placedShips.map((ship) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${ship.icon} ${ship.name} (length ${ship.length})`)
          .setEmoji(ship.emoji)
          .setValue(ship.name.toLowerCase())
      )
    );
  const removeShipActionRow = new ActionRowBuilder().addComponents(removeShipSelectMenu);

  return [titleTextDisplay, boardTextDisplay, removeShipActionRow];
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
      .setLabel('Place Ship!')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Success);
    const actionRow = new ActionRowBuilder().addComponents(placeButton);

    const placeButtonMessage = await interaction.followUp({
      components: [updatedBoardTextDisplay, actionRow],
      flags: MessageFlags.IsComponentsV2,
    });
    boardSetup.placementFeedbackMessageId = placeButtonMessage.id;

    // Stop previous collector
    const { collectors } = session[playerKey];
    if (collectors.placementFeedbackCollector) {
      collectors.placementFeedbackCollector.stop();
    }
    collectors.placementFeedbackCollector = createCollector(
      placeButtonMessage,
      session,
      playerKey,
      handleOnCollect
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

async function sendRemovalFeedback(interaction, session, playerKey) {
  const { boardSetup } = session[playerKey];
  const { selectedRemoveShip } = boardSetup;

  // If for some reason nothing was selected (but this should never happen)
  if (!selectedRemoveShip) {
    return;
  }

  if (boardSetup.removalFeedbackMessageId) {
    try {
      const oldMessage = await interaction.channel.messages.fetch(
        boardSetup.removalFeedbackMessageId
      );
      await oldMessage.delete();
    } catch (error) {
      // Message might already be deleted, ignore error
    }
  }

  const boardWithRemovedShip = generateShipRemovalBoard(session, playerKey);
  const updatedBoardText = boardRepresentation(boardWithRemovedShip);
  const updatedBoardTextDisplay = new TextDisplayBuilder().setContent(
    'This is what your board will look like:' + updatedBoardText + '\nClick below to confirm:'
  );

  const removeButton = new ButtonBuilder()
    .setCustomId('confirm_remove_ship_button')
    .setLabel('Remove Ship!')
    .setEmoji('🎯')
    .setStyle(ButtonStyle.Success);
  const actionRow = new ActionRowBuilder().addComponents(removeButton);

  const removeButtonMessage = await interaction.followUp({
    components: [updatedBoardTextDisplay, actionRow],
    flags: MessageFlags.IsComponentsV2,
  });
  boardSetup.removalFeedbackMessageId = removeButtonMessage.id;

  // Stop previous collector
  const { collectors } = session[playerKey];
  if (collectors.removalFeedbackCollector) {
    collectors.removalFeedbackCollector.stop();
  }
  collectors.removalFeedbackCollector = createCollector(
    removeButtonMessage,
    session,
    playerKey,
    handleOnCollect
  );
}

async function startBoardSetup(interaction, session) {
  const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

  // Send initial message to p1
  const welcomeP1Component = new TextDisplayBuilder().setContent(
    `# Welcome to Battleship!\n## You are fighting against <@${session.p2.id}>`
  );
  const p1Message = await p1Channel.send({
    components: [welcomeP1Component, ...generateMainInterface(session, 'p1')],
    flags: MessageFlags.IsComponentsV2,
  });

  // Send initial message to p2
  const welcomeP2Component = new TextDisplayBuilder().setContent(
    `# Welcome to Battleship!\n## You are fighting against <@${session.p1.id}>`
  );
  const p2Message = await p2Channel.send({
    components: [welcomeP2Component, ...generateMainInterface(session, 'p2')],
    flags: MessageFlags.IsComponentsV2,
  });

  // Create collectors for both messages
  session.p1.collectors.currentInterfaceCollector = createCollector(
    p1Message,
    session,
    'p1',
    handleOnCollect
  );
  session.p2.collectors.currentInterfaceCollector = createCollector(
    p2Message,
    session,
    'p2',
    handleOnCollect
  );

  // Start timer for both channels
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

  // Stop previous collector
  const { collectors } = session[playerKey];
  if (collectors.currentInterfaceCollector) {
    collectors.currentInterfaceCollector.stop();
  }
  collectors.currentInterfaceCollector = createCollector(
    placeInterfaceMessage,
    session,
    playerKey,
    handleOnCollect
  );
}

async function startRemovingFlow(interaction, session, playerKey) {
  // Acknowledge "Remove Ship" pressed immediately
  await interaction.reply('Opening ship removal...');

  // Stop previous collector
  const removeInterfaceMessage = await interaction.channel.send({
    components: generateRemovingInterface(session, playerKey),
    flags: MessageFlags.IsComponentsV2,
  });
  const { collectors } = session[playerKey];
  if (collectors.currentInterfaceCollector) {
    collectors.currentInterfaceCollector.stop();
  }

  collectors.currentInterfaceCollector = createCollector(
    removeInterfaceMessage,
    session,
    playerKey,
    handleOnCollect
  );
}

async function handleOnCollect(interaction, session, playerKey) {
  const { currentInterface } = session[playerKey].boardSetup;

  resetIdleTimer(interaction.channel, session, playerKey);
  if (currentInterface === 'main') {
    console.log("Nigga i'm at main");
    await handleMainInterfaceClick(interaction, session, playerKey);
  } else if (currentInterface === 'placing') {
    console.log("Nigga i'm at placing");
    await handlePlacingInterfaceClick(interaction, session, playerKey);
  } else if (currentInterface === 'removing') {
    await handleRemovingInterfaceClick(interaction, session, playerKey);
  }
}

async function handleMainInterfaceClick(interaction, session, playerKey) {
  const { boardSetup, collectors } = session[playerKey];
  const { ships } = boardSetup;
  switch (interaction.customId) {
    case 'place_ship_button':
      const shipsToBePlaced = ships.filter((ship) => !ship.placed);

      // Tell that there are no more ships to be palced
      if (shipsToBePlaced.length === 0) {
        await interaction.reply('You have no more ships to be placed 🤪');

        if (collectors.currentInterfaceCollector) {
          collectors.currentInterfaceCollector.stop();
        }

        const mainInterfaceMessage = await interaction.channel.send({
          components: generateMainInterface(session, playerKey),
          flags: MessageFlags.IsComponentsV2,
        });

        collectors.currentInterfaceCollector = createCollector(
          mainInterfaceMessage,
          session,
          playerKey,
          handleOnCollect
        );
      } else {
        console.log('PLACE SHIP BABY');
        boardSetup.currentInterface = 'placing';
        console.log(`currentInterface is now: ${boardSetup.currentInterface}`);
        await startPlacingFlow(interaction, session, playerKey);
      }

      break;
    case 'remove_ship_button':
      const shipsAlreadyPlaced = ships.filter((ship) => ship.placed);

      if (shipsAlreadyPlaced.length === 0) {
        await interaction.reply('You have no ships to be removed 🤪');

        if (collectors.currentInterfaceCollector) {
          collectors.currentInterfaceCollector.stop();
        }

        const mainInterfaceMessage = await interaction.channel.send({
          components: generateMainInterface(session, playerKey),
          flags: MessageFlags.IsComponentsV2,
        });

        collectors.currentInterfaceCollector = createCollector(
          mainInterfaceMessage,
          session,
          playerKey,
          handleOnCollect
        );
      } else {
        console.log('REMOVING SHIPS BABY!');
        boardSetup.currentInterface = 'removing';
        await startRemovingFlow(interaction, session, playerKey);
      }

      break;
    case 'finish_setup_button':
      // Clear boardSetup and stop idle timer
      session[playerKey].boardSetup = null;
      stopIdleTimer(session, playerKey);

      const opponentKey = playerKey === 'p1' ? 'p2' : 'p1';

      // Player finishes setting up their board before their opponent
      if (session.status === 'board_setup') {
        const { id: opponentId } = session[opponentKey];

        // Tell user to wait for their opponent
        const finishSetupTextDisplay = new TextDisplayBuilder().setContent(
          `# You have finished setting up your board! 😆\nPlease wait for <@${opponentId}> to finish setting up their board!`
        );
        await interaction.reply({
          components: [finishSetupTextDisplay],
          flags: MessageFlags.IsComponentsV2,
        });

        session.status = `board_setup_${playerKey}_ready`;

        console.log(`THIS NIGGA IS READY TO PLAY!!!!!! ${playerKey}`);
        console.log(session);
      } else {
        // Their opponent has finished setting up their board first

        // Tell user they have finished setting up their board
        const letsStartTextDisplay = new TextDisplayBuilder().setContent(
          '# You have finished setting up your board! 😆'
        );
        await interaction.reply({
          components: [letsStartTextDisplay],
          flags: MessageFlags.IsComponentsV2,
        });

        // Tell opponent that user has finished setting up their board
        const opponentChannel = await interaction.client.channels.fetch(
          session[opponentKey].textChannelId
        );
        const { id: userId } = session[playerKey];
        const userFinishedSetupTextDisplay = new TextDisplayBuilder().setContent(
          `# Hello again!\n <@${userId}> has finished setting up their board!`
        );
        await opponentChannel.send({
          components: [userFinishedSetupTextDisplay],
          flags: MessageFlags.IsComponentsV2,
        });

        session.status = 'starting_game';
        await startGamePhase(interaction, session);

        console.log(`BOTH NIGGAS READY TO PLAY!!!!!! ${playerKey}`);
        console.log(session);
      }

      break;
    default:
      // For future custom ids
      console.log(`nah wtf is this custom id? ${interaction.customId}`);
      break;
  }
}

async function handlePlacingInterfaceClick(interaction, session, playerKey) {
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

      playerObj.collectors.currentInterfaceCollector = createCollector(
        mainInterfaceMessage,
        session,
        playerKey,
        handleOnCollect
      );
      break;
    default:
      console.log(`Nahh, wtf is this interaction.customId: ${interaction.customId}`);
      break;
  }

  console.log(boardSetup);
}

async function handleRemovingInterfaceClick(interaction, session, playerKey) {
  const { boardSetup } = session[playerKey];

  switch (interaction.customId) {
    case 'remove_ship_select_menu':
      const selectedRemoveShipName = interaction.values[0];
      const shipObj = boardSetup.ships.find(
        (ship) => ship.name.toLowerCase() === selectedRemoveShipName
      );
      boardSetup.selectedRemoveShip = shipObj;

      await interaction.deferUpdate();
      await sendRemovalFeedback(interaction, session, playerKey);
      break;

    case 'confirm_remove_ship_button':
      const boardWithShipRemoved = generateShipRemovalBoard(session, playerKey);
      const playerObj = session[playerKey];

      // Remove ship
      playerObj.board = boardWithShipRemoved;

      const selectedRemoveShipFromShips = boardSetup.ships.find(
        (ship) => ship.id === boardSetup.selectedRemoveShip.id
      );

      selectedRemoveShipFromShips.placed = false;
      boardSetup.selectedRemoveShip = null;
      boardSetup.currentInterface = 'main';

      await interaction.reply('Ship removed ahh');

      const mainInterfaceMessage = await interaction.channel.send({
        components: generateMainInterface(session, playerKey),
        flags: MessageFlags.IsComponentsV2,
      });

      if (playerObj.collectors.removalFeedbackCollector) {
        playerObj.collectors.removalFeedbackCollector.stop();
      }

      if (playerObj.collectors.currentInterfaceCollector) {
        playerObj.collectors.currentInterfaceCollector.stop();
      }

      playerObj.collectors.currentInterfaceCollector = createCollector(
        mainInterfaceMessage,
        session,
        playerKey,
        handleOnCollect
      );
      break;

    default:
      console.log(`Nahh, wtf is this interaction.customId: ${interaction.customId}`);
      break;
  }
}

module.exports = {
  startBoardSetup,
};
