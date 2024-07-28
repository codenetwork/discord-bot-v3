# Code Network Discord Bot v3

This is the latest and greatest generation of Code Network's Discord Bot. This aims to provide some features to enhance our online community, and is open to contributions from our wider community.

## Working on the Bot

### Getting Started on the Project
1. First, clone this repository to your computer.
2. Run `npm install` to get the latest dependencies
3. Copy `.env.example` to `.env` (DO NOT MOVE) and type in your Discord token (as explained below).

### Testing the Bot
If you wish to test the bot, you will need to create one under your own Discord account and install it on your own server. You will not be able to install it on the official Code Network server for security reasons.

1. Log on to the [Discord developer portal](https://discord.com/developers/applications)
2. Click **New Application** and enter a useful name (e.g. Code Network Bot)
3. Click on **Bot** in the left-hand column, and then click on **Reset Token**. After accepting the dialog box that appears, copy the token and then paste into the `.env` file next to `DISCORD_TOKEN`.

To add the bot to your own server:
1. Click on **OAuth2** on the left menu.
2. In the **OAuth2 URL Generator** section, select the **bot** and **applications.commands** options.
3. Then, click the Copy button next to the generated URL, and paste that into your browser.
4. Select the server you are trying to add the bot too, and then click **Authorise**.
