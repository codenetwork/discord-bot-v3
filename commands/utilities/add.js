const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('add')
		.setDescription('Adds two numbers together')
    .addNumberOption(option =>
      option.setName("num1").setDescription("Number 1").setRequired(true)
    )
    .addNumberOption(option =>
      option.setName("num2").setDescription("Number 2").setRequired(true)
    ),
	async execute(interaction) {
    const num1 = interaction.options.getNumber("num1");
    const num2 = interaction.options.getNumber("num2");
    await interaction.reply(`Answer to ${num1} + ${num2} is ${num1+num2}`);
	},
};
