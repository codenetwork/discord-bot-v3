const { TIMEOUT_IDLE } = require('./constants');
function createCollector(message, session, playerKey, onCollect) {
  const playerId = session[playerKey].id;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === playerId,
    time: TIMEOUT_IDLE,
  });

  collector.on('collect', async (interaction) => {
    await onCollect(interaction, session, playerKey);
  });

  collector.on('end', async (collected, reason) => {
    const playerObj = session[playerKey];
    // Remove the collector reference when it ends
    Object.keys(playerObj.collectors).forEach((key) => {
      if (playerObj.collectors[key] === collector) {
        delete playerObj.collectors[key];
      }
    });
  });

  return collector;
}

module.exports = { createCollector };
