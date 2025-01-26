require("./utils");
const { debug } = require("console");
const fs = require("fs");

let wordArray = [];
fs.readFile('list\\wordlist.10000.txt', function(err, data) {
    if(err) throw err;
    wordArray = data.toString().split("\n");
    for (let i = 0; i < wordArray.length; i++) {
      if (wordArray[i].length > 3) {
        wordArray[i] = wordArray[i].trim();
      }
    }
});

function GetRandom() {
  let randomWord = wordArray.random();
  return randomWord;
}

/**
* @param {string} word
*/
function GetScramble(word) {
  let arr = Array.from(word);
  return arr.shuffle().join(" ");
}

module.exports = { GetRandom, GetScramble }