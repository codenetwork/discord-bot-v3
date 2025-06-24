const { handleBoardSetupInteraction } = require('./battleship/boardSetupHandler');
// Import other component handlers here as they're added

async function handleComponentInteraction(interaction) {
  // Route based on customId prefix
  if (interaction.customId.startsWith('battleship_')) {
    await handleBattleshipComponents(interaction);
  } else {
    console.log(`Unhandled component interaction: ${interaction.customId}`);
  }
}

async function handleBattleshipComponents(interaction) {
  const { findSessionByChannel } = require('./battleship/boardSetupHandler');
  const session = findSessionByChannel(interaction.channelId);

  if (session && session.status === 'board_setup') {
    await handleBoardSetupInteraction(interaction, session);
  }
}

module.exports = { handleComponentInteraction };
