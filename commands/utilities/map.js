// Discord slash command that links to a campus's map.



// VARAIABLES
const { SlashCommandBuilder } = require("discord.js");
const link = "https://www.qut.edu.au/about/campuses-and-facilities/maps-and-getting-here";
let response;


// COMMAND BUILDER
module.exports =
{
	// Sets up the command.
	data: new SlashCommandBuilder()
		.setName("map")
		.setDescription("DMs the user a link to the map of the selected QUT campus."),

	// Enables the command's functionality.
	async execute(interaction)
	{
		response = `Here's the link to the campuses' maps: ${link}.`;
		await interaction.reply(response);		
	},
};