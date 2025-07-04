const { SEA, SEA_ICON, SHIPS, BOARD_HEIGHT, BOARD_WIDTH, GUESS } = require('./constants');

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
  if (!isPlacementValid(session, playerKey)) {
    return;
  }

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

function boardWithDamageRepresentation(board, opponentGuesses) {
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
    row.forEach((cell, colIdx) => {
      let icon;

      // Check if this position has been attacked
      const guessState = opponentGuesses[idx][colIdx];

      if (guessState === GUESS.MISS_ID) {
        // Show miss regardless of what's underneath
        icon = GUESS.MISS_ICON;
      } else if (guessState === GUESS.HIT_ID) {
        // Show hit or sunk if ship is destroyed
        const shipId = board[idx][colIdx];
        if (shipId !== SEA && isShipSunk(board, opponentGuesses, shipId)) {
          icon = GUESS.SUNK_SHIP_ICON;
        } else {
          icon = GUESS.HIT_ICON;
        }
      } else {
        // No attack here yet - show original board content
        const shipIcon = SHIPS.find((ship) => ship.id === cell)?.icon || SEA_ICON;
        icon = shipIcon;
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

module.exports = {
  boardRepresentation,
  isPlacementValid,
  generateShipPlacementBoard,
  generateShipRemovalBoard,
  isShipSunk,
  guessesRepresentation,
  boardWithDamageRepresentation,
};
