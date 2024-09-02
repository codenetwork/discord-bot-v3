
const { SlashCommandBuilder, PermissionsBitField, Interaction } = require('discord.js');
const { GetWordle, checkGuess, checkExist } = require("../../utils/worldle.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordle')
    .setDescription('worldle game'),

  /**
  * @param {Interaction} interaction
  */
  async execute(interaction) {
    await interaction.deferReply();
    let randomWord = GetWordle();
    sendResult(interaction, 6, randomWord);
  },
};
/**
* @param {Interaction} interaction
* @param {Number} guessLeft
* @param {string} correctWord
*/
async function sendResult(interaction, guessLeft, correctWord, prevNote = "") {
  if (guessLeft == 0) {
    await interaction.followUp(`Out of guesses\n${correctWord} is the correct answer!`);
    return;
  }
  await interaction.followUp(`${prevNote}${guessLeft} guess left. Input your guess`);
  const filter = (m) => m.author.id == interaction.user.id
  interaction.channel.awaitMessages({ filter: filter, max: 1, time: 300_000, errors: ['time'], })
    .then(collected => {
      let message = collected.first().content;
      // console.log(collected);
      // console.log(collected.first());
      // console.log(message.length);
      message = message.trim();
      message = message.toLowerCase();
      if (message.length != 5) {
        sendResult(interaction, guessLeft, correctWord, "Answer must be of length 5\n");
      }
      else if (!checkExist(message)) {
        sendResult(interaction, guessLeft, correctWord, "Not a real word\n");
      }
      else if (collected.first().content == correctWord) {
        interaction.followUp(`${correctWord} is the correct answer!`);
        return;
      }
      else {
        guessLeft--;
        sendResult(interaction, guessLeft, correctWord, checkGuess(correctWord, message) + "\n");
      }
    })
    .catch(e => {
      console.log(e);
      interaction.followUp(`TIME OUT!\n${correctWord} is the correct answer!`);
    });
}