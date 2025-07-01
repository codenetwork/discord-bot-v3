async function startGamePhase(interaction, session) {
  session.gameStartedTimestamp = new Date();

  const p1Channel = await interaction.client.channels.fetch(session.p1.textChannelId);
  const p2Channel = await interaction.client.channels.fetch(session.p2.textChannelId);

  await p1Channel.send('LET THE GAMES BEGIN! NIGGA!!!!!');
  await p2Channel.send('LET THE GAMES BEGIN! NIGGA!!!!!');
}

module.exports = {
  startGamePhase,
};
