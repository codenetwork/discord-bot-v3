require("./utils");
const { debug } = require("console");
const fs = require("fs");

let wordArray = [];
fs.readFile('list\\wordle-nyt-words-14855.txt', function(err, data) {
    if(err) throw err;
    wordArray = data.toString().split("\n");
    for (let i = 0; i < wordArray.length; i++) {
      wordArray[i] = wordArray[i].trim();
      wordArray[i] = wordArray[i].substring(0,5);
    }
});


function GetWordle() {
  let randomWord = wordArray.random();
  return randomWord;
}

  /**
  * @param {string} rightGuessString
  * @param {string} guessString
  * @return {string}
  */
function checkGuess (rightGuessString, guessString) {
  let rightGuess = Array.from(rightGuessString);
  let currentGuess = Array.from(guessString);
  let rightGuessDuplicate = Array.from(rightGuessString);
  let ret = [].fill("", 0, 5);
  //First pass to mark all exactly correct characters
  for (let i = 0; i < 5; i++) {
    let letterPosition = rightGuess.indexOf(currentGuess[i])
    if (letterPosition === -1) {
      ret[i] = currentGuess[i];
    } else {
        if (currentGuess[i] === rightGuess[i]) {
          ret[i] = `__***${currentGuess[i]}***__`;
          rightGuessDuplicate[i] = "#";
        }
    }
  }
  // Only right words, wrong position left
  for (let i = 0; i < 5; i++) {
    if (currentGuess[i] === rightGuess[i]) continue;
    let letterPosition = rightGuess.indexOf(currentGuess[i])
    let letterPositionDuplicate = rightGuess.indexOf(rightGuessDuplicate[i])
    // Not enough correct characters
    if (letterPositionDuplicate === -1 && letterPosition != -1) {
      ret[i] = currentGuess[i];
    }
    else if (letterPosition != -1) {
      ret[i] = `__${currentGuess[i]}__`;
    }
  }
  return ret.join(" ");
}

  /**
  * @param {string} guessString
  * @return {bool}
  */
function checkExist(guessString) {
  let guess = guessString.toString();
  return wordArray.includes(guess);
}

module.exports = { GetWordle, checkGuess, checkExist }