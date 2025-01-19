# Code Network Discord Bot v3

This is the latest and greatest generation of Code Network's Discord Bot. This aims to provide some features to enhance our online community, and is open to contributions from our wider community.

## How do I contribute?

If you would like to contribute some code to this project, we invite you to [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the repository, commit changes to your fork, and then open a pull request.

[Click here to fork the repository!](https://github.com/codenetwork/discord-bot-v3/fork)

## Working on the Bot

### Getting Started on the Project
1. First, create a fork, and then clone the repository fork to your computer.
2. Run `npm install` to get the latest dependencies

### Adding Environment Variables
If you wish to test the bot, you will need to create one under your own Discord account and install it on your own server. You will not be able to install it on the official Code Network server for security reasons.

1. Log on to the [Discord developer portal](https://discord.com/developers/applications)
2. Click **New Application** and enter a useful name (e.g. Code Network Bot)
3. Click on **Bot** in the left-hand column, and then click on **Reset Token**. After accepting the dialog box that appears, copy the token and then paste into the `.env` file next to `DISCORD_TOKEN`.
4. Click on **General Information**, and then click **Copy** under Application ID. Paste this in the `.env` file next to `CLIENT_ID`
5. If you haven't already, enable Developer Mode in your Discord (by going to User Settings --> Advanced --> Developer Mode, click on it to make it green)
6. Next, right click on your server name near the top-right of your screen, then left-click on **Copy Server ID** and paste this next to `GUILD_ID`
7. Be sure to enable **MESSAGE CONTENT INTENT**

To add the bot to your own server:
1. Click on **OAuth2** on the left menu.
2. In the **OAuth2 URL Generator** section, select the **bot** and **applications.commands** options.
3. Then, click the Copy button next to the generated URL, and paste that into your browser.
4. Select the server you are trying to add the bot too, and then click **Authorise**.

Note: you will need to create your own server or have a server you manage to add the bot to it. If you do not already have a Discord server, create one by scrolling down in the left menu to the + button, click Create a server, give it a name, and then you're good to do the above steps.

To run the bot, you will need to run these two commands in order, every time:
1. `node deploy-commands.js`
2. `node index.js`

When you are done with the server, terminate it (Ctrl+C).
