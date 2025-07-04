const {
  MessageFlags,
  TextDisplayBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
} = require('discord.js');
const { createCollector } = require('./interactionHandlers');
const { SEA, GUESS, BOARD_HEIGHT, BOARD_WIDTH, MOVE_RESULT, SHIPS } = require('./constants');
const {
  startIdleTimer,
  createGamePhaseInSession,
  resetIdleTimer,
  sessionChannelsViewOnly,
  stopIdleTimer,
  winnerSession,
} = require('./sessionManagement');
const {
  boardRepresentation,
  isShipSunk,
  guessesRepresentation,
  boardWithDamageRepresentation,
} = require('./boardUtils');

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

  if (isMoveValid) {
    const confirmGuessTextDisplay = new TextDisplayBuilder().setContent(
      `Confirm guess **${selectedRow}${selectedColumn}**?`
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
    if (collectors.moveFeedback) {
      collectors.moveFeedback.stop();
    }
    collectors.moveFeedback = createCollector(
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
    remainingShips,
  } = move;

  let resultText = '';
  let resultEmoji = '';
  let accentColor = 0x808080; // Default gray

  const shipHit = SHIPS.find((ship) => ship.id === shipHitId);

  switch (result) {
    case MOVE_RESULT.HIT:
      resultText = `You hit their ${shipHit.emoji} **${shipHit.name}** (length ${shipHit.length}) at **${row}${column}**`;
      resultEmoji = '💥';
      accentColor = 0xff9500; // Orange for hit
      break;
    case MOVE_RESULT.MISS:
      resultText = `You hit nothing at **${row}${column}**`;
      resultEmoji = '🚫';
      accentColor = 0x6c757d; // Gray for miss
      break;
    case MOVE_RESULT.SUNK:
      resultText = `You've sunken their ${shipHit.emoji} **${shipHit.name}** (length ${shipHit.length}) at **${row}${column}**\n\n**${remainingShips}** ships remaining`;
      resultEmoji = '🌊';
      accentColor = 0x198754; // Green for sunk
      break;
  }

  const defenderKey = attackerKey === 'p1' ? 'p2' : 'p1';
  const guessBoard = guessesRepresentation(
    session[attackerKey].guesses,
    session[defenderKey].board
  );

  const updateContainer = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `# ${resultEmoji} ${result.charAt(0).toUpperCase() + result.slice(1)}!`
      )
    )
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent(resultText))
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(`**Your Guess Board:**${guessBoard}`)
    );

  await interaction.reply({
    components: [updateContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function sendDefenderUpdate(attackerInteraction, session, defenderKey, move) {
  const defenderChannel = await attackerInteraction.client.channels.fetch(
    session[defenderKey].textChannelId
  );

  const {
    position: { row, column },
    result,
    shipHit: shipHitId,
    remainingShips,
  } = move;

  let resultText = '';
  let resultEmoji = '';
  let accentColor = 0x808080; // Default gray

  const shipHit = SHIPS.find((ship) => ship.id === shipHitId);

  switch (result) {
    case MOVE_RESULT.HIT:
      resultText = `They hit your ${shipHit.emoji} **${shipHit.name}** (length ${shipHit.length}) at **${row}${column}**`;
      resultEmoji = '💥';
      accentColor = 0xdc3545; // Red for defender being hit
      break;
    case MOVE_RESULT.MISS:
      resultText = `They hit nothing at **${row}${column}**`;
      resultEmoji = '🚫';
      accentColor = 0x198754; // Green for defender (they're safe)
      break;
    case MOVE_RESULT.SUNK:
      resultText = `They've sunken your ${shipHit.emoji} **${shipHit.name}** (length ${shipHit.length}) at **${row}${column}**\n\n**${remainingShips}** of your ships remaining`;
      resultEmoji = '😭';
      accentColor = 0x8c0000; // Dark red for sunk ship
      break;
  }

  const attackerKey = defenderKey === 'p1' ? 'p2' : 'p1';
  const boardWithDamage = boardWithDamageRepresentation(
    session[defenderKey].board,
    session[attackerKey].guesses
  );

  const updateContainer = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `# ${resultEmoji} ${
          result === MOVE_RESULT.MISS
            ? 'They Missed!'
            : result === MOVE_RESULT.HIT
            ? 'Your Ship Was Hit!'
            : 'Sunken Ship!'
        }`
      )
    )
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent(resultText))
    .addSeparatorComponents((separator) => separator)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(`**Your Board:**${boardWithDamage}`)
    );

  await defenderChannel.send({
    components: [updateContainer],
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
      await interaction.deferUpdate();
      const selectedRow = interaction.values[0];
      gamePhase.selectedRow = selectedRow;

      await sendMoveFeedback(interaction, session, playerKey);
      break;

    case 'col_select_menu':
      await interaction.deferUpdate();
      const selectedColumn = interaction.values[0];
      gamePhase.selectedColumn = selectedColumn;

      await sendMoveFeedback(interaction, session, playerKey);
      break;

    case 'confirm_guess_button':
      const move = makeMove(session);

      const attackerKey = playerKey;
      const defenderKey = playerKey === 'p1' ? 'p2' : 'p1';
      await sendAttackerUpdate(interaction, session, attackerKey, move);
      await sendDefenderUpdate(interaction, session, defenderKey, move);

      // Clear move interface and move feedback collector
      const { collectors } = session[playerKey];
      if (collectors.moveInterface) {
        collectors.moveInterface.stop();
      }
      if (collectors.moveFeedback) {
        collectors.moveFeedback.stop();
      }

      const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
      const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

      const isGameOngoing = move.remainingShips !== 0;
      if (isGameOngoing) {
        // Stop checking for timeout for the current attacker
        // now it's the defender's turn to attack
        stopIdleTimer(session, attackerKey);

        // Prepare game phase for next turn
        gamePhase.turn = gamePhase.turn === 'p1' ? 'p2' : 'p1'; // Next player's turn
        gamePhase.selectedRow = null;
        gamePhase.selectedColumn = null;

        await startTurn(session, p1Channel, p2Channel);
      } else {
        // Tell both players who won (and lost)
        await announceWinner(session, p1Channel, p2Channel, attackerKey);

        // Finishes the session and marks winner
        winnerSession(session, attackerKey);

        // Make both channels view only and everyone else in the server able to see
        await sessionChannelsViewOnly(session, interaction.client);
      }

      break;

    default:
      console.log(`Invalid customid ${interaction.customId}`);
  }
}

async function startGamePhase(interaction, session) {
  session.gameStartedTimestamp = new Date();

  const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

  await p1Channel.send('Battleship starting...');
  await p2Channel.send('Battleship starting...');

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
