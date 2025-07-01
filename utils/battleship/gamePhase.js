const {
  MessageFlags,
  TextDisplayBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createCollector } = require('./interactionHandlers');
const { SEA, GUESS, BOARD_HEIGHT, BOARD_WIDTH, MOVE_RESULT, SHIPS } = require('./constants');
const { startIdleTimer, createGamePhaseInSession, resetIdleTimer } = require('./sessionManagement');

function isShipSunk(opponentBoard, guesses, shipId) {
  // Don't check if it's water
  if (shipId === SEA) {
    return false;
  }

  // Find all positions of this ship and check if they're all hit
  for (let row = 0; row < opponentBoard.length; row++) {
    for (let col = 0; col < opponentBoard[row].length; col++) {
      if (opponentBoard[row][col] === shipId) {
        // Found a piece of this ship - check if it's been hit
        if (guesses[row][col] !== GUESS.HIT_ID) {
          return false; // This piece hasn't been hit yet
        }
      }
    }
  }
  return true; // All pieces of this ship have been hit
}

function guessesRepresentation(guesses, opponentBoard) {
  const parts = ['```\n'];
  const width = guesses[0].length;
  const height = guesses.length;

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
  guesses.forEach((row, idx) => {
    const asciiValA = 'A'.charCodeAt(0);
    const rowChar = String.fromCharCode(asciiValA + idx);

    // Row content
    parts.push(`${rowChar} │`);
    row.forEach((cell, colIdx) => {
      let icon;

      if (cell === GUESS.UNGUESSED_ID) {
        icon = GUESS.UNGUESSED_ICON;
      } else if (cell === GUESS.MISS_ID) {
        icon = GUESS.MISS_ICON;
      } else if (cell === GUESS.HIT_ID) {
        // Check if the ship at this position is sunk
        const shipId = opponentBoard[idx][colIdx];
        if (isShipSunk(opponentBoard, guesses, shipId)) {
          icon = GUESS.SUNK_SHIP_ICON;
        } else {
          icon = GUESS.HIT_ICON;
        }
      } else {
        // Fallback for unexpected values
        icon = '?';
      }

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

/*
  const move = {
  turn: 1,                    // Turn number
  position: { row: 'A', col: 3 },  // Human-readable position
  coordinates: { row: 0, col: 2 }, // Array indices
  result: 'hit',              // 'hit', 'miss', 'sunk'
  shipHit: 2,                 // Ship ID if hit, null if miss
  shipSunk: null,             // Ship ID if sunk, null otherwise
  timestamp: new Date(),
  remainingShips: 4           // Ships left after this move
};
 */

function countRemainingShips(opponentBoard, guesses) {
  // Get all unique ship IDs from the board (excluding SEA)
  const shipIds = new Set();

  for (let row = 0; row < opponentBoard.length; row++) {
    for (let col = 0; col < opponentBoard[row].length; col++) {
      const cellValue = opponentBoard[row][col];
      if (cellValue !== SEA) {
        shipIds.add(cellValue);
      }
    }
  }

  // Count ships that are NOT sunk
  let remainingShips = 0;
  shipIds.forEach((shipId) => {
    if (!isShipSunk(opponentBoard, guesses, shipId)) {
      remainingShips++;
    }
  });

  return remainingShips;
}

function makeMove(session) {
  const { turn: attackerKey } = session.gamePhase;
  const defenderKey = attackerKey === 'p1' ? 'p2' : 'p1';
  const attacker = session[attackerKey];
  const defender = session[defenderKey];

  const { selectedRow, selectedColumn } = session.gamePhase;
  const rowIdx = selectedRow.charCodeAt(0) - 'A'.charCodeAt(0);
  const colIdx = selectedColumn - 1;

  // Check if for some reason already guessed
  if (attacker.guesses[rowIdx][colIdx] !== GUESS.UNGUESSED_ID) {
    console.log("NAH NIGGA THIS AIN'T SUPPOSED TO HAPPEN");
    return;
  }

  // Evaluate result
  const shipId = defender.board[rowIdx][colIdx];
  const isHit = shipId !== SEA;
  let result = isHit ? MOVE_RESULT.HIT : MOVE_RESULT.MISS;

  attacker.guesses[rowIdx][colIdx] = isHit ? GUESS.HIT_ID : GUESS.MISS_ID;

  let shipSunk = null;
  if (isHit && isShipSunk(defender.board, attacker.guesses, shipId)) {
    result = MOVE_RESULT.SUNK;
    shipSunk = shipId;
  }

  const move = {
    turnNumber: attacker.moves.length + 1,
    position: { row: selectedRow, column: selectedColumn },
    coordinates: { row: rowIdx, column: colIdx },
    result,
    shipHit: shipId,
    shipSunk,
    timeStamp: new Date(),
    remainingShips: countRemainingShips(defender.board, attacker.guesses),
  };

  attacker.moves.push(move);
  return move;
}

function generateMoveInterface(session) {
  const { turn } = session.gamePhase;
  const { guesses } = session[turn];
  const opponentKey = turn === 'p1' ? 'p2' : 'p1';
  const { board: opponentBoard } = session[opponentKey];

  // Create guess board text display
  const guessBoardTextDisplay = new TextDisplayBuilder().setContent(
    "# It's your turn!\nThis is your guess board: " + guessesRepresentation(guesses, opponentBoard)
  );

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

  return [guessBoardTextDisplay, rowActionRow, colActionRow];
}

function generateWaitingMessage(session) {
  const opponentKey = session.gamePhase.turn; // Whoever's turn it is, is the opponent
  const { id: opponentId } = session[opponentKey];
  const waitMessageTextDisplay = new TextDisplayBuilder().setContent(
    `# It's currently not your turn!\nWait for <@${opponentId}> to make a move!`
  );

  return [waitMessageTextDisplay];
}

async function sendMoveFeedback(interaction, session, playerKey) {
  const { gamePhase } = session;
  const { selectedRow, selectedColumn } = gamePhase;

  // If any of the selections are incomplete
  if (!selectedRow || !selectedColumn) {
    return;
  }

  if (gamePhase.moveFeedbackMessageId) {
    try {
      const oldMessage = await interaction.channel.messages.fetch(gamePhase.moveFeedbackMessageId);
      await oldMessage.delete();
    } catch (error) {
      // Message might already be deleted, ignore error
    }
  }

  // Send a message saying whether their move is valid
  // If it's valid, a confirmation button is sent
  // If it's not valid, a simple message saying why it's invalid is sent
  const { guesses } = session[playerKey];
  const rowIdx = selectedRow.charCodeAt(0) - 'A'.charCodeAt(0); // row in indexes
  const colIdx = selectedColumn - 1;
  const isMoveValid = guesses[rowIdx][colIdx] === GUESS.UNGUESSED_ID;

  console.log('BEFORE ISMOVEVALIE');
  if (isMoveValid) {
    console.log('NAH NIGGA THE MOVE IS VALID!!!!');
    const confirmGuessTextDisplay = new TextDisplayBuilder().setContent(
      `Confirm guess '${selectedRow}${selectedColumn}'?`
    );

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_guess_button')
      .setLabel(`Guess ${selectedRow}${selectedColumn}`)
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Success);
    const actionRow = new ActionRowBuilder().addComponents(confirmButton);

    const confirmGuessMessage = await interaction.followUp({
      components: [confirmGuessTextDisplay, actionRow],
      flags: MessageFlags.IsComponentsV2,
    });
    gamePhase.moveFeedbackMessageId = confirmGuessMessage.id;

    const { collectors } = session[playerKey];
    if (collectors.moveFeedbackCollector) {
      collectors.moveFeedbackCollector.stop();
    }
    collectors.moveFeedbackCollector = createCollector(
      confirmGuessMessage,
      session,
      playerKey,
      handleOnCollect
    );
  } else {
    const invalidGuessTextDisplay = new TextDisplayBuilder().setContent(
      'You have already guessed there! Please change your guess.'
    );

    const invalidGuessMessage = await interaction.followUp({
      components: [invalidGuessTextDisplay],
      flags: MessageFlags.IsComponentsV2,
    });
    gamePhase.moveFeedbackMessageId = invalidGuessMessage.id;
  }
}

async function sendAttackerUpdate(interaction, session, attackerKey, move) {
  const {
    position: { row, column },
    result,
    shipHit: shipHitId,
    // shipSunk,
    remainingShips,
  } = move;

  const resultTextDisplay = new TextDisplayBuilder();
  const shipHit = SHIPS.find((ship) => ship.id === shipHitId);

  switch (result) {
    case MOVE_RESULT.HIT:
      resultTextDisplay.setContent(
        `# Hit! 💥\nYou hit their ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**`
      );
      break;
    case MOVE_RESULT.MISS:
      resultTextDisplay.setContent(`# Miss! 🚫\n You hit nothing at **${row}${column}**`);
      break;
    case MOVE_RESULT.SUNK:
      resultTextDisplay.setContent(
        `# Sunken Ship! 🌊\nYou've sunken their ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**\nThere are ${remainingShips} remaining ships.`
      );
  }

  await interaction.reply({
    components: [resultTextDisplay],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function sendDefenderUpdate(interaction, session, defenderKey, move) {
  // Note that interaction is actually the attacker's interaction

  const defenderChannel = await interaction.client.channels.fetch(
    session[defenderKey].textChannelId
  );

  const {
    position: { row, column },
    result,
    shipHit: shipHitId,
    // shipSunk,
    remainingShips,
  } = move;

  const resultTextDisplay = new TextDisplayBuilder();
  const shipHit = SHIPS.find((ship) => ship.id === shipHitId);

  switch (result) {
    case MOVE_RESULT.HIT:
      resultTextDisplay.setContent(
        `# Your ship was Hit! 💥\nThey hit your ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**`
      );
      break;
    case MOVE_RESULT.MISS:
      resultTextDisplay.setContent(`# They Missed! 🚫\n They hit nothing at **${row}${column}**`);
      break;
    case MOVE_RESULT.SUNK:
      resultTextDisplay.setContent(
        `# Sunken Ship! 😭\nThey've sunken your ship ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**\nYou have ${remainingShips} remaining ships.`
      );
      break;
  }

  await defenderChannel.send({
    components: [resultTextDisplay],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function handleOnCollect(interaction, session, playerKey) {
  const { gamePhase } = session;

  resetIdleTimer(interaction.channel, session, playerKey);
  switch (interaction.customId) {
    case 'row_select_menu':
      const selectedRow = interaction.values[0];
      gamePhase.selectedRow = selectedRow;

      console.log(gamePhase);
      await interaction.deferUpdate();
      await sendMoveFeedback(interaction, session, playerKey);
      break;

    case 'col_select_menu':
      const selectedColumn = interaction.values[0];
      gamePhase.selectedColumn = selectedColumn;

      console.log(gamePhase);
      await interaction.deferUpdate();
      await sendMoveFeedback(interaction, session, playerKey);
      break;

    case 'confirm_guess_button':
      const move = makeMove(session);
      console.log('THE MOVE THAT WAS MADE!');
      console.log(move);

      const attackerKey = playerKey;
      const defenderKey = playerKey === 'p1' ? 'p2' : 'p1';
      await sendAttackerUpdate(interaction, session, attackerKey, move);
      await sendDefenderUpdate(interaction, session, defenderKey, move);

      // Clear move interface and move feedback collector
      const { collectors } = session[playerKey];
      if (collectors.moveInterface) {
        collectors.moveInterface.stop();
      }
      if (collectors.moveFeedbackCollector) {
        collectors.moveFeedbackCollector.stop();
      }

      // Prepare game phase for next turn
      gamePhase.turn = gamePhase.turn === 'p1' ? 'p2' : 'p1'; // Next player's turn
      gamePhase.selectedRow = null;
      gamePhase.selectedColumn = null;

      const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
      const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);
      await startTurn(session, p1Channel, p2Channel);

      break;

    default:
      console.log(`nah wtf is this customid ${interaction.customId}`);
  }
}

async function startGamePhase(interaction, session) {
  session.gameStartedTimestamp = new Date();

  const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

  await p1Channel.send('LET THE GAMES BEGIN! NIGGA!!!!!');
  await p2Channel.send('LET THE GAMES BEGIN! NIGGA!!!!!');

  createGamePhaseInSession(session);

  await startTurn(session, p1Channel, p2Channel);
}

async function startTurn(session, p1Channel, p2Channel) {
  const { turn } = session.gamePhase;
  const isP1Turn = turn === 'p1';
  const playerMoveChannel = isP1Turn ? p1Channel : p2Channel;
  const playerWaitChannel = isP1Turn ? p2Channel : p1Channel;

  const playerMoveMessage = await playerMoveChannel.send({
    components: generateMoveInterface(session),
    flags: MessageFlags.IsComponentsV2,
  });

  // Create collector and start timer for attacker
  const { collectors } = session[turn];
  if (collectors.moveInterface) {
    collectors.moveInterface.stop();
  }
  collectors.moveInterface = createCollector(playerMoveMessage, session, turn, handleOnCollect);
  startIdleTimer(playerMoveChannel, session, turn);

  await playerWaitChannel.send({
    components: generateWaitingMessage(session),
    flags: MessageFlags.IsComponentsV2,
  });
}

module.exports = {
  startGamePhase,
};
