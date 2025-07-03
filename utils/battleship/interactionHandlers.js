const { TIMEOUT_TIME } = require('./constants');
function createCollector(message, session, playerKey, onCollect) {
  const playerId = session[playerKey].id;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === playerId,
    time: TIMEOUT_TIME,
  });

  collector.on('collect', async (interaction) => {
    // const { currentInterface } = session[playerKey].boardSetup;
    // console.log(currentInterface);

    await onCollect(interaction, session, playerKey);
  });

  // collector.on('end', async (collected, reason) => {
  //   // TODO: make user unable to do shit once timed out lol
  //   if (reason === 'time') await message.channel.send({ content: `timed out from ${message.id}` });
  //   console.log(reason);
  // });

  collector.on('end', async (collected, reason) => {
    const playerObj = session[playerKey];
    // Remove the collector reference when it ends
    Object.keys(playerObj.collectors).forEach((key) => {
      if (playerObj.collectors[key] === collector) {
        delete playerObj.collectors[key];
      }
    });
    console.log(`Collector ended: ${reason}`);
  });

  return collector;
}

module.exports = { createCollector };
