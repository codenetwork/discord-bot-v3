const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const key = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(key);

const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    maxOutputTokens: 400,
    temperature: 2,
    topK: 5,
  },

});

module.exports = {
  cooldown: 60,
  data: new SlashCommandBuilder()
    .setName('gemini')
    .setDescription('Call Gemini Chatbot')
    .addStringOption(option =>
      option.setName("query").setDescription("Query").setRequired(true)
    ),

  /**
  * @param {Interaction} interaction
  */
  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString("query");
    const response = await model.generateContent([query]);
    await interaction.followUp(`${response.response.text()}`);
  },
};
