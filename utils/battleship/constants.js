const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 10;

const SEA = 0;

const AVAILABLE_SHIPS = [
  {
    id: 1,
    name: 'Carrier',
    length: 5,
    emoji: '🛳',
  },
  {
    id: 2,
    name: 'Battleship',
    length: 4,
    emoji: '⚔️',
  },
  {
    id: 3,
    name: 'Cruiser',
    length: 3,
    emoji: '🚤',
  },
  {
    id: 4,
    name: 'Submarine',
    length: 3,
    emoji: '🚇',
  },
  {
    id: 5,
    name: 'Destroyer',
    length: 2,
    emoji: '🚀',
  },
  ,
];

module.exports = {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  SEA,
  AVAILABLE_SHIPS,
};
