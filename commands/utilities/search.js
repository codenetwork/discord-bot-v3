const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Searches for a user and prints their roles')


        .addStringOption(option =>
            option.setName("id").setDescription("user id").setAutocomplete(true).setRequired(true)
        ),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();

        //Get roles from server.
        const choices = Array.from(interaction.guild.members.cache.map(m => m.user));

        //Setup role list for auto-complete.
        const filtered = choices.filter(choice => choice.displayName.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice.displayName, value: choice.id })),
        );
    },

    async execute(interaction) {
        const id = interaction.options.getString("id");
        const member = interaction.guild.members.cache.get(id)
        if (!member) {
            await interaction.reply("No member found.");
            return;
        }
        const roles = member.roles.cache.map(r => r.name).join(', ')

        await interaction.reply(`User **${member}** has roles: ` + roles);
    },
};
