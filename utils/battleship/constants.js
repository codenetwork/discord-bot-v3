const BOARD_WIDTH = 8;
const BOARD_HEIGHT = 8;

const SEA = 0;
const SEA_ICON = ' ';

const TIMEOUT_TIME = 300_000; // 5 minutes

const SHIPS = [
  {
    id: 1,
    name: 'Carrier',
    length: 5,
    emoji: '🛳',
    icon: '◆',
  },
  {
    id: 2,
    name: 'Battleship',
    length: 4,
    emoji: '⚔️',
    icon: '■',
  },
  {
    id: 3,
    name: 'Destroyer',
    length: 3,
    emoji: '🚢',
    icon: '▲',
  },
  {
    id: 4,
    name: 'Submarine',
    length: 3,
    emoji: '🫧',
    icon: '●',
  },
  {
    id: 5,
    name: 'Patrol Boat',
    length: 2,
    emoji: '🚤',
    icon: '*',
  },
];

const GUESS = {
  UNGUESSED_ID: 0,
  UNGUESSED_ICON: ' ',
  HIT_ID: 1,
  HIT_ICON: 'O',
  MISS_ID: 2,
  MISS_ICON: 'X',
  SUNK_SHIP_ICON: '#',
};

const MOVE_RESULT = {
  HIT: 'hit',
  MISS: 'miss',
  SUNK: 'sunk',
};

module.exports = {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  TIMEOUT_TIME,
  SEA,
  SEA_ICON,
  SHIPS,
  GUESS,
  MOVE_RESULT,
};
