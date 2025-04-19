const {
  SlashCommandBuilder,
  ChannelType,
  PermissionOverwrites,
  MessageFlags,
} = require('discord.js');

// TODO:
// 1. Create categories ✅
// 2. Delete categories ✅
// 3. Create text channels ✅
// 4. Send private DMs to members ✅
// 5. Send private DMs with buttons to members
// 6. Members reply to private DMs
// 7. Create session once p2 accepts (includes validation of time, etc.)

/**
 * `sessions` type (per item)
 * session:
 *  {
 *    status: "invite_pending", "invite_expired", "invite_cancelled", "board_setup", "turn_p1", "turn_p2", "finish_p1_win", "finish_p2_win",
 *    p1:
 *     {
 *       "id": Member.id,
 *       "board": [n x m],
 *       "guesses": [n x m],
 *       "textChannelId": Channel.id
 *     },
 *    p2:
 *     {
 *       "id": Member.id,
 *       "board": [n x m],
 *       "guesses": [n x m],
 *       "textChannelId": Channel.id
 *     },
 *    inviteTimestamp: Date,
 *    inviteAcceptedTimestamp: Date
 *  }
 *
 */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battleship')
    .setDescription('Manage the battleship game')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('createcategory')
        .setDescription('Creates a new category given a name.')
        .addStringOption((option) =>
          option.setName('name').setDescription('Name of the category to create').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deletecategory')
        .setDescription('Deletes a category')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the category to be deleted.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('createtextchannel')
        .setDescription('Creates a new text channel at category "Battleship".')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the text channel to be created.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('invite')
        .setDescription('Invites another player to play')
        .addUserOption((option) =>
          option.setName('player').setDescription('The player you want to invite').setRequired(true)
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'createcategory') {
      const categoryName = interaction.options.getString('name');

      const existingCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === categoryName && channel.type === ChannelType.GuildCategory
      );

      if (existingCategory) {
        return interaction.reply({
          content: `Category "${categoryName}" already exists!`,
          ephemeral: MessageFlags.Ephemeral,
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
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'deletecategory') {
      const categoryName = interaction.options.getString('name');

      const existingCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === categoryName && channel.type === ChannelType.GuildCategory
      );

      if (!existingCategory) {
        return interaction.reply({
          content: `Category "${categoryName}" does not exist!`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      try {
        await existingCategory.delete();
        return interaction.reply(`Category "${categoryName}" has been deleted!`);
      } catch (error) {
        return interaction.reply({
          content: `Failed to delete "${categoryName}" :(`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'createtextchannel') {
      const battleshipCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === 'Battleship' && channel.type === ChannelType.GuildCategory
      );

      if (!battleshipCategory) {
        return interaction.reply({
          content: `Category "Battleship" not found. Please create this category first.`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      const textChannelName = interaction.options.getString('name');

      try {
        const newChannel = await interaction.guild.channels.create({
          name: textChannelName,
          type: ChannelType.GuildText,
          parent: battleshipCategory.id,
          // permissionOverwrites: [
          //   id:
          // ]
        });
        return interaction.reply(`Text channel "${newChannel.name}" has been created!`);
      } catch (error) {}
    } else if (subcommand === 'invite') {
      const inviter = interaction.user;
      const invitee = interaction.options.getUser('player');

      // In case invitee is invalid
      if (!invitee || inviter.id == invitee.id) {
        return interaction.reply({
          content: 'You must invite a valid player!',
          ephemeral: MessageFlags.Ephemeral,
        });
      }

      try {
        await invitee.send(`Ma nigga you've been invited by ${inviter.username}!`);
        return interaction.reply({
          content: `Invitation sent to ${invitee.username}.`,
          ephemeral: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error('Failed to send DM: ', error);
        return interaction.reply({
          content: `Could not send a DM to ${invitee.username} They may have DMs disabled.`,
          ephemeral: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
