const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createcategory')
    .setDescription('Creates a new category given a name.')
    .addStringOption((option) =>
      option.setName('name').setDescription('Name of the category').setRequired(true)
    ),
  async execute(interaction) {
    const categoryName = interaction.options.getString('name');

    const existingCategory = interaction.guild.channels.cache.find(
      (channel) => channel.name === categoryName && channel.type === ChannelType.GuildCategory
    );

    if (existingCategory) {
      return interaction.reply({
        content: `Category "${categoryName}" already exists!`,
        ephemeral: true,
      });
    }

    try {
      const newCategory = await interaction.guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
      });
      interaction.reply(`Category "${categoryName}" has been created!`);
    } catch (error) {
      interaction.reply({
        content: `Failed to create category "${categoryName}" :(\n${error}`,
        ephemeral: true,
      });
    }
  },
};
