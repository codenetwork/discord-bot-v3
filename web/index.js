const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    

const router = express.Router();
async function addCommands()
{

}

async function removeCommands()
{

}

async function sendMessage()
{

}
async function joinVoice()
{

}
async function leaveVoice()
{

}
async function playSong()
{

}
async function pauseSong()
{

}
async function resumeSong()
{

}
router.get('/user-count', async(req, res) => {


  
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    const count = guild.memberCount;
   
    console.log(count);
    res.json({count: count});
})
client.login(process.env.DISCORD_TOKEN);
module.exports = router;