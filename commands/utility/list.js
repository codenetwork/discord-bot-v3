const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('Lists all of the CN executives.'),
	async execute(interaction) {
		let memberArray = interaction.guild.roles.cache.get('1267402048580620378').members.map(m=>m.displayName);

		let memberPersons = "";

		memberArray.forEach(element =>
		{
			memberPersons +=element.toString();
			memberPersons += "   ";
		});

		if (memberArray.length == 0) {
			let errorMessage = "ERROR. Server members not found.";
			console.log(errorMessage);
			await interaction.reply(errorMessage);
			return
		}

		await interaction.reply(memberPersons);
	},
};