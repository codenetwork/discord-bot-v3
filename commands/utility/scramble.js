
const { SlashCommandBuilder, PermissionsBitField, Interaction } = require('discord.js');
const { GetRandom, GetScramble } = require("../../utils/scramble.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('scramble')
		.setDescription('word scramble game'),

  /**
  * @param {Interaction} interaction The date
  */
	async execute(interaction) {
    await interaction.deferReply();
    let randomWord = GetRandom();
    let shuffled = GetScramble(randomWord);
    sendResult(interaction, randomWord, shuffled, 0);
	},
};
  /**
  * @param {Interaction} interaction The date
  * @param {string} correctWord
  * @param {string} shuffled
  * @param {number} hintCount
  */
async function sendResult(interaction, correctWord, shuffled, hintCount = 0, prevNote = "") {
  let hintedMessage = ""
  if (hintCount > 0) {
    hintedWord = correctWord.substring(0,hintCount);
    hintedMessage = `\nHint: ${hintedWord}`;
  }
  await interaction.followUp(`${prevNote}The shuffled word is: ${shuffled}${hintedMessage}\nInput your guess (Or "h" for hints)`);
  const filter = (m) => m.author.id == interaction.user.id
  interaction.channel.awaitMessages({ filter: filter, max: 1, time: 30_000, errors: ['time'],  })
    .then(collected => {
      let message = collected.first().content;
      message = message.trim();
      message = message.toLowerCase();
      if (message == "h") {
        if (hintCount == correctWord.length) {
          sendResult(interaction, correctWord, shuffled, hintCount, "Alread maxed\n");
        }
        else {
          sendResult(interaction, correctWord, shuffled, hintCount + 1, `Hint used: ${hintCount + 1}\n`);
        }
      }
      else if (message == correctWord) {
        interaction.followUp(`${correctWord} is the correct answer!`);
        return;
      }
      else {
        sendResult(interaction, correctWord, shuffled, hintCount, "Wrong answer, try again\n");
      }
    })
    .catch(e => {
      console.log(e);
      interaction.followUp(`TIME OUT!\n${correctWord} is the correct answer!`);
    });
}