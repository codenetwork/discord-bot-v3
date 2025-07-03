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
const {
  startIdleTimer,
  createGamePhaseInSession,
  resetIdleTimer,
  finishSession,
} = require('./sessionManagement');
const {
  boardRepresentation,
  isShipSunk,
  guessesRepresentation,
  defenderBoardWithDamage,
} = require('./boardUtils');

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

  let resultText = '';
  const shipHit = SHIPS.find((ship) => ship.id === shipHitId);

  switch (result) {
    case MOVE_RESULT.HIT:
      resultText = `# Hit! 💥\nYou hit their ${shipHit.emoji} ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**`;
      break;
    case MOVE_RESULT.MISS:
      resultText = `# Miss! 🚫\nYou hit nothing at **${row}${column}**`;
      break;
    case MOVE_RESULT.SUNK:
      resultText = `# Sunken Ship! 🌊\nYou've sunken their ${shipHit.emoji} ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**\nThere are ${remainingShips} remaining ships.`;
      break;
  }

  const defenderKey = attackerKey === 'p1' ? 'p2' : 'p1';
  resultText +=
    '\nYour guess board:' +
    guessesRepresentation(session[attackerKey].guesses, session[defenderKey].board);
  const resultTextDisplay = new TextDisplayBuilder().setContent(resultText);

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

  let resultText = '';
  const shipHit = SHIPS.find((ship) => ship.id === shipHitId);

  switch (result) {
    case MOVE_RESULT.HIT:
      resultText = `# Your ship was Hit! 💥\nThey hit your ${shipHit.emoji} ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**`;
      break;
    case MOVE_RESULT.MISS:
      resultText = `# They Missed! 🚫\nThey hit nothing at **${row}${column}**`;
      break;
    case MOVE_RESULT.SUNK:
      resultText = `# Sunken Ship! 😭\nThey've sunken your ship ${shipHit.emoji} ${shipHit.name} (length ${shipHit.length}) at **${row}${column}**\nYou have ${remainingShips} remaining ships.`;
      break;
  }

  const attackerKey = defenderKey === 'p1' ? 'p2' : 'p1';
  resultText +=
    '\nYour board:\n' +
    defenderBoardWithDamage(session[attackerKey].guesses, session[defenderKey].board);
  const resultTextDisplay = new TextDisplayBuilder().setContent(resultText);

  await defenderChannel.send({
    components: [resultTextDisplay],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function announceWinner(session, p1Channel, p2Channel, winnerKey, move) {
  const isP1Winner = winnerKey === 'p1';
  const winner = session[winnerKey];
  const loserKey = isP1Winner ? 'p2' : 'p1';
  const loser = session[loserKey];
  const winnerChannel = isP1Winner ? p1Channel : p2Channel;
  const loserChannel = isP1Winner ? p2Channel : p1Channel;

  const { board: winnerBoard, id: winnerId } = winner;
  const { board: loserBoard, id: loserId } = loser;

  const winnerBoardText = boardRepresentation(winnerBoard);
  const loserBoardText = boardRepresentation(loserBoard);

  const winnerTextDisplay = new TextDisplayBuilder().setContent(
    `# You have won! 🥳🏆\nThis is <@${loserId}>'s board:\n${loserBoardText}`
  );
  const loserTextDisplay = new TextDisplayBuilder().setContent(
    `# You have lost! 😞\nThis is <@${winnerId}>'s board:\n${winnerBoardText}`
  );

  await winnerChannel.send({
    components: [winnerTextDisplay],
    flags: MessageFlags.IsComponentsV2,
  });

  await loserChannel.send({
    components: [loserTextDisplay],
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

      const isGameOngoing = move.remainingShips !== 0;

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

      const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
      const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

      if (isGameOngoing) {
        // Prepare game phase for next turn
        gamePhase.turn = gamePhase.turn === 'p1' ? 'p2' : 'p1'; // Next player's turn
        gamePhase.selectedRow = null;
        gamePhase.selectedColumn = null;

        await startTurn(session, p1Channel, p2Channel);
      } else {
        await announceWinner(session, p1Channel, p2Channel, attackerKey);
        finishSession(session, `${attackerKey}_win`);

        // Make channels view only
        const viewOnlyPermission = {
          ViewChannel: true,
          SendMessages: false,
          AddReactions: false,
        };
        await p1Channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone.id,
          viewOnlyPermission
        );
        await p2Channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone.id,
          viewOnlyPermission
        );

        // Overwrite p1 and p2's permissions to respective channels
        await p1Channel.permissionOverwrites.edit(session.p1.id, viewOnlyPermission);
        await p1Channel.permissionOverwrites.edit(session.p2.id, viewOnlyPermission);
        await p2Channel.permissionOverwrites.edit(session.p2.id, viewOnlyPermission);
        await p2Channel.permissionOverwrites.edit(session.p1.id, viewOnlyPermission);
      }

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
