//*Requires "PRESENCE INTENT" in the Discord Developer Portal to be enabled for full functionality.

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("list")
		.setDescription("Lists some members of the CN discord based on their role.")
		.addStringOption(option =>
            option.setName("role")
				.setDescription("Options: \"execs\", \"mods\", and \"vets\".")
				.setAutocomplete(true)
				.setRequired(true)),
	
	async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused();
		const choices = ["execs", "mods", "vets"];
		const filtered = choices.filter(choice => choice.startsWith(focusedValue));
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},

	async execute(interaction) {
		//VARIABLES
		let memberArray = [];
		let role = interaction.options.get("role");
		let memberPersons = "";
		
		//switch statement that decides what role to get based on input.
		switch (role.value.toString().toLowerCase())
		{
			case "execs":
				memberArray = interaction.guild.roles.cache.get("1267402048580620378").members.map(m=>m.displayName);    //CN executive role ID: 349872786241617920
				break;
			case "mods":
				memberArray = interaction.guild.roles.cache.get("1269948580022452275").members.map(m=>m.displayName);    //CN moderators role ID: 349872786241617920
				break;
			case "vets":
				memberArray = interaction.guild.roles.cache.get("1269945736993181780").members.map(m=>m.displayName);    //CN veterans role ID: 349872786241617920
				break;
			default:
				break;
		}

		//for-each statement that converts the array of server members into a string.
		memberArray.forEach(element =>
		{
			memberPersons +=element.toString();
			memberPersons += "   ";
		});

		//if statement for error handling.
		if (memberArray.length == 0) {
			let errorMessage = "ERROR. Please try again.";
			console.log(errorMessage);
			await interaction.reply(errorMessage);
			return
		}

		await interaction.reply(memberPersons);
	},
};