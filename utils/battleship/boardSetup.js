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
const { BOARD_HEIGHT, BOARD_WIDTH } = require('./constants');
const { startIdleTimer, resetIdleTimer, stopIdleTimer } = require('./sessionManagement');
const { createCollector } = require('./interactionHandlers');
const { startGamePhase } = require('./gamePhase');
const {
  boardRepresentation,
  isPlacementValid,
  generateShipPlacementBoard,
  generateShipRemovalBoard,
} = require('./boardUtils');

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
    .setStyle(ButtonStyle.Secondary);

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
    '# Place a ship!\n' +
      'Select your ship, orientation, row, and column below.\n' +
      '✅ **A confirmation button will appear once all options are selected.**\n' +
      'What your board currently looks like:'
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
      new StringSelectMenuOptionBuilder()
        .setLabel('Horizontal (→ Left to Right)')
        .setDescription('Ship will extend to the right')
        .setValue('Horizontal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Vertical (↓ Top to Bottom)')
        .setDescription('Ship will extend downwards')
        .setValue('Vertical')
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
    if (collectors.placementFeedback) {
      collectors.placementFeedback.stop();
    }
    collectors.placementFeedback = createCollector(
      placeButtonMessage,
      session,
      playerKey,
      handleOnCollect
    );
  } else {
    let errorMessage = 'Your placement selection is invalid!\n**Possible issues:**\n';

    const { length: shipLength } = selectedShip;
    const colIdx = selectedColumn - 1;
    const rowIdx = selectedRow.charCodeAt(0) - 'A'.charCodeAt(0);

    if (selectedOrientation === 'Horizontal' && colIdx + shipLength > BOARD_WIDTH) {
      errorMessage += `• Ship extends beyond right edge (needs ${shipLength} spaces)\n`;
    }
    if (selectedOrientation === 'Vertical' && rowIdx + shipLength > BOARD_HEIGHT) {
      errorMessage += `• Ship extends beyond bottom edge (needs ${shipLength} spaces)\n`;
    }

    // Check for overlaps...
    errorMessage += '• Ship overlaps with existing ship\nPlease adjust your selections!';

    const invalidPlacementTextDisplay = new TextDisplayBuilder().setContent(errorMessage);

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
  if (collectors.removalFeedback) {
    collectors.removalFeedback.stop();
  }
  collectors.removalFeedback = createCollector(
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
  session.p1.collectors.currentInterface = createCollector(
    p1Message,
    session,
    'p1',
    handleOnCollect
  );
  session.p2.collectors.currentInterface = createCollector(
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
  if (collectors.currentInterface) {
    collectors.currentInterface.stop();
  }
  collectors.currentInterface = createCollector(
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
  if (collectors.currentInterface) {
    collectors.currentInterface.stop();
  }

  collectors.currentInterface = createCollector(
    removeInterfaceMessage,
    session,
    playerKey,
    handleOnCollect
  );
}

async function handleOnCollect(interaction, session, playerKey) {
  const { currentInterface } = session[playerKey].boardSetup;

  resetIdleTimer(interaction.channel, session, playerKey);
  switch (currentInterface) {
    case 'main':
      await handleMainInterfaceClick(interaction, session, playerKey);
      break;
    case 'placing':
      await handlePlacingInterfaceClick(interaction, session, playerKey);
      break;
    case 'removing':
      await handleRemovingInterfaceClick(interaction, session, playerKey);
      break;
    default:
      console.log(`Invalid currentInterface ${currentInterface}`);
      break;
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

        if (collectors.currentInterface) {
          collectors.currentInterface.stop();
        }

        const mainInterfaceMessage = await interaction.channel.send({
          components: generateMainInterface(session, playerKey),
          flags: MessageFlags.IsComponentsV2,
        });

        collectors.currentInterface = createCollector(
          mainInterfaceMessage,
          session,
          playerKey,
          handleOnCollect
        );
      } else {
        boardSetup.currentInterface = 'placing';

        await startPlacingFlow(interaction, session, playerKey);
      }
      break;

    case 'remove_ship_button':
      const shipsAlreadyPlaced = ships.filter((ship) => ship.placed);

      if (shipsAlreadyPlaced.length === 0) {
        await interaction.reply('You have no ships to be removed 🤪');

        if (collectors.currentInterface) {
          collectors.currentInterface.stop();
        }

        const mainInterfaceMessage = await interaction.channel.send({
          components: generateMainInterface(session, playerKey),
          flags: MessageFlags.IsComponentsV2,
        });

        collectors.currentInterface = createCollector(
          mainInterfaceMessage,
          session,
          playerKey,
          handleOnCollect
        );
      } else {
        boardSetup.currentInterface = 'removing';
        await startRemovingFlow(interaction, session, playerKey);
      }
      break;

    case 'finish_setup_button':
      // Clear boardSetup and stop idle timer
      stopIdleTimer(session, playerKey);
      // session[playerKey].boardSetup = null;

      // Mark player as ready
      const opponentKey = playerKey === 'p1' ? 'p2' : 'p1';
      session[playerKey].boardSetup.hasFinishedSetup = true;

      const isOpponentReady = session[opponentKey].boardSetup.hasFinishedSetup;

      if (!isOpponentReady) {
        // First player to finish setup - waiting for opponent
        const { id: opponentId } = session[opponentKey];

        // Tell player to wait for their opponent
        const finishSetupTextDisplay = new TextDisplayBuilder().setContent(
          `# You have finished setting up your board! 😆\nPlease wait for <@${opponentId}> to finish setting up their board!`
        );
        await interaction.reply({
          components: [finishSetupTextDisplay],
          flags: MessageFlags.IsComponentsV2,
        });

        // Tell opponent that the current player is ready
        const opponentChannel = await interaction.client.channels.fetch(
          session[opponentKey].textChannelId
        );
        const playerId = session[playerKey].id;
        await opponentChannel.send(
          `Your oponent <@${playerId}> has finished setting up their board! 😁`
        );
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
          `# Your opponent is ready! 😛\n <@${userId}> has finished setting up their board!`
        );
        await opponentChannel.send({
          components: [userFinishedSetupTextDisplay],
          flags: MessageFlags.IsComponentsV2,
        });

        await startGamePhase(interaction, session);

        // Remove references of boardSetup
        session[playerKey].boardSetup = null;
        session[opponentKey].boardSetup = null;
      }
      break;

    default:
      console.log(`Invalid customId: ${interaction.customId}`);
      break;
  }
}

async function handlePlacingInterfaceClick(interaction, session, playerKey) {
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

      await interaction.reply('ship placed ahh');
      const mainInterfaceMessage = await interaction.channel.send({
        components: generateMainInterface(session, playerKey),
        flags: MessageFlags.IsComponentsV2,
      });

      if (playerObj.collectors.placementFeedback) {
        playerObj.collectors.placementFeedback.stop();
      }

      if (playerObj.collectors.currentInterface) {
        playerObj.collectors.currentInterface.stop();
      }

      playerObj.collectors.currentInterface = createCollector(
        mainInterfaceMessage,
        session,
        playerKey,
        handleOnCollect
      );
      break;
    default:
      console.log(`Invalid customId: ${interaction.customId}`);
      break;
  }
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

      if (playerObj.collectors.removalFeedback) {
        playerObj.collectors.removalFeedback.stop();
      }

      if (playerObj.collectors.currentInterface) {
        playerObj.collectors.currentInterface.stop();
      }

      playerObj.collectors.currentInterface = createCollector(
        mainInterfaceMessage,
        session,
        playerKey,
        handleOnCollect
      );
      break;

    default:
      console.log(`Invalid customId: ${interaction.customId}`);
      break;
  }
}

module.exports = {
  startBoardSetup,
};
