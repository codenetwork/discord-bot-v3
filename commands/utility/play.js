const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } = require('discord.js');
const axios = require('axios'); // Use axios instead of request
const cheerio = require('cheerio');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song')
        .addStringOption(option =>
            option.setName('songname')
                .setDescription('Name of the song to lookup')
                .setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: 'You need to join a voice channel before using this command.',
                ephemeral: true,
            });
            return;
        }
        // Reply to the interaction with a loading message

        const option = interaction.options.getString('songname');
        //&filter=music_songs
        const url = `https://pipedapi.kavin.rocks/search?q=${option}&filter=all`;
        const voicestatus = interaction.member.voice.channel;
        //console.log(voicestatus);
        // play.authorization();
        await interaction.reply({ content: '🔍 Searching for song...', ephemeral: true });

        try {
            // Fetch the HTML data
            // const spotify = await play.search(option, { source : { deezer : "track" } })
            const response = await axios.get(url);
            const results = response.data.items;
            // console.log(spotify);
            if (!results || results === 0) {
                // If no results found
                await interaction.editReply({ content: 'No songs found', ephemeral: true });
            } else {
                // Create the select menu for user to choose
                const select = new StringSelectMenuBuilder()
                    .setCustomId('starter')
                    .setPlaceholder('Make a selection!')
                    .addOptions(
                        results.map(item => {
                            return new StringSelectMenuOptionBuilder()
                                .setLabel(item.title ?? "(No Title)")
                                .setDescription(item.uploaderName ?? "Unknown Artist")
                                .setValue(item.url.replace("/watch?v=", ""));
                        })
                    );

                const row = new ActionRowBuilder().addComponents(select);

                // Update the reply with the select menu
                const response = await interaction.editReply({
                    content: 'Choose a song!',
                    components: [row],
                });

                // Collector filter to ensure the user is interacting
                const collectorFilter = i => i.customId === 'starter' && i.user.id === interaction.user.id;

                // Await the interaction response with a timeout
                try {
                    const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 60_000 });
                    const connection = joinVoiceChannel({
                        channelId: interaction.member.voice.channel.id,
                        guildId: interaction.member.voice.channel.guild.id,
                        adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
                    });
                    const player = createAudioPlayer();
                    connection.subscribe(player);

                    const videoId = confirmation.values[0]; // Extract the first value from the array
                    const url = `https://www.youtube.com/watch?v=${videoId}`;

                    try {
                        // streams.pipe(transcoder);
                        const stream = ytdl(url, {
                            filter: 'audioonly',
                            quality: 'highestaudio',
                            highWaterMark: 1 << 25 // 32MB buffer
                        });


                        stream.on('error', (error) => {
                            console.error('Error in ytdl stream:', error);
                            interaction.followUp({ content: 'Error playing the song. Please try again.', ephemeral: true });
                        });

                        stream.on('start', () => {
                            console.log('Stream started');
                        });
                        const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });

                        player.play(resource);

                        await confirmation.update({ content: `Playing Now: ${url}`, components: [] });
                    } catch (error) {
                        console.error('Error setting up audio playback:', error);
                        await confirmation.update({ content: 'Failed to play the song. Please try again.', components: [] });
                    }



                } catch (e) {
                    console.log(e)
                    await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling', components: [] });
                }



              
            }
        } catch (error) {
            // Handle request or parsing errors
            console.error('Error while fetching song data:', error);
            await interaction.editReply({ content: 'Hmmm, Something went wrong', ephemeral: true });
        }
    },
};