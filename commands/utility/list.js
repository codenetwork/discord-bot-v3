const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('Lists all of the CN executives.'),
	async execute(interaction) {
		let memberArray = interaction.guild.roles.cache.get('1267402048580620378').members.map(m=>m.user.tag);
		console.log(memberArray);

		let memberPersons = "";

		memberArray.forEach(element => {
			console.log(element.toString());
			memberPersons +=element.toString();
			memberPersons += "   ";
		});

		await interaction.reply(memberPersons);
	},
};