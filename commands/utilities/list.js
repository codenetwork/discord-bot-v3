/**
 * @name: list.js
 * @description: Discord slash command that prints all the server members with a specific role.
 * @author: Anthony Choi. Assistance provided by Yiming He.
 * 
 * NOTE: Requires "PRESENCE INTENT" in the Discord Developer Portal to be enabled for full functionality.
 */



// VARIABLES
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
let memberArray = [];
let role;
let memberPersons;


// COMMAND BUILDER
module.exports = {
	data: new SlashCommandBuilder()
		.setName("list")
		.setDescription("Lists some members of the CN discord based on their role.")
		.addStringOption(option =>
            option.setName("role")
				.setDescription("Enter the role name.")
				.setAutocomplete(true)
				.setRequired(true)),
	
	async autocomplete(interaction)
	{
		const focusedValue = interaction.options.getFocused().toLowerCase();

		//Gets roles from server.
		const choices = Array.from(interaction.guild.roles.cache.map(m=>m.name));

		//Sets up role list for auto-complete.
		const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue));
		await interaction.respond(filtered.map(choice => (
			{ 
				name: choice, 
				value: choice 
			})));
	},

	async execute(interaction)
	{
		role = interaction.options.get("role");
		memberPersons = `Members with the ${role.value} role: `;

		//Enables auto-complete of roles in command.
		memberArray = interaction.guild.roles.cache.find(r=>r.name.toLowerCase() == role.value.toString().toLowerCase()).members.map(m=>m.displayName);

		//for-each statement that converts the array of server members into a string.
		memberArray.forEach(element =>
		{
			memberPersons +=element.toString();
			memberPersons += ", ";
		});

		//End of string formatting.
		memberPersons = memberPersons.slice(0, -2);
		memberPersons += ".";

		//if statement for error handling.
		if (memberArray.length == 0) {
			let errorMessage = "ERROR. Please try again.";
			console.log(errorMessage);
			await interaction.reply(errorMessage);
			return
		}

		await interaction.reply(
		{
			content: memberPersons,
			flags: MessageFlags.Ephemeral
		});
	},
};