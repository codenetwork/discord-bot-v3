const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("list")
		.setDescription("Lists members of the CN discord based on their role.")
		.addStringOption(option =>
            option.setName("role")
				.setDescription("Options: \"execs\", \"mods\", and \"vets\.")
				.setRequired(true)),

	async execute(interaction) {
		//VARIABLES
		let memberArray = [];
		let role = interaction.options.get("role");
		let memberPersons = "";

		switch (role.value.toString())
		{
			case "execs":
				memberArray = interaction.guild.roles.cache.get("1267402048580620378").members.map(m=>m.displayName);    //CN Veterals Role ID: 349872786241617920
				break;
			case "mods":
				memberArray = interaction.guild.roles.cache.get("1269948580022452275").members.map(m=>m.displayName);    //CN Veterals Role ID: 349872786241617920
				break;
			case "vets":
				memberArray = interaction.guild.roles.cache.get("1269945736993181780").members.map(m=>m.displayName);    //CN Veterals Role ID: 349872786241617920
				break;
		}

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