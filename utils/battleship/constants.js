const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 10;

const SEA = 0;
const SEA_ICON = '≈';

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
    icon: '★',
  },
];

module.exports = {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  SEA,
  SEA_ICON,
  SHIPS,
};
