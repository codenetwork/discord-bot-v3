const { sessions } = require('./sessionManagement');

function findSessionByChannel(channelId) {
  return sessions.find(
    (session) => session.p1.textChannelId === channelId || session.p2.textChannelId === channelId
  );
}

async function handleBoardSetupInteraction(interaction, session) {
  // Massive ass switch statement
  switch (interaction.customId) {
  }
}

module.exports = {
  findSessionByChannel,
  handleBoardSetupInteraction,
};
