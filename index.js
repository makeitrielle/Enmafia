require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let game = { players: [], roles: new Map(), mafiaChannelId: null };

client.once('ready', async () => {
    // Sync Slash Commands
    await client.application.commands.set([
        new SlashCommandBuilder().setName('lobby').setDescription('Open EnMafia Lobby'),
        new SlashCommandBuilder().setName('start').setDescription('Start the hit (4-15 players)'),
        new SlashCommandBuilder().setName('end').setDescription('Clean up the evidence')
    ]);
    console.log('🕶️ EnMafia is online and ready.');
});

client.on('interactionCreate', async (interaction) => {
    // Button Logic: Joining the Lobby
    if (interaction.isButton() && interaction.customId === 'join') {
        if (game.players.some(p => p.id === interaction.user.id)) {
            return interaction.reply({ content: 'You are already in the family.', ephemeral: true });
        }
        if (game.players.length >= 15) return interaction.reply({ content: 'The hit squad is full.', ephemeral: true });
        
        game.players.push(interaction.user);
        await interaction.reply(`${interaction.user.username} joined the crew! (${game.players.length}/15)`);
    }

    // Command Logic
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'lobby') {
            game.players = [];
            const embed = new EmbedBuilder()
                .setTitle('🕶️ EnMafia: Vampires Recruitment')
                .setDescription('The Don is looking for 15 associates. Are you in?')
                .setColor(0x1a1a1a);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join').setLabel('Join Family').setStyle(ButtonStyle.Danger)
            );
            await interaction.reply({ embeds: [embed], components: [row] });
        }

        if (interaction.commandName === 'start') {
            if (game.players.length < 4) return interaction.reply("Not enough members to start the game.");
            
            const shuffled = [...game.players].sort(() => 0.5 - Math.random());
            const mafiaCount = game.players.length >= 10 ? 3 : 2;
            const mafia = shuffled.splice(0, mafiaCount);

            // DM Secret Roles
            for (const m of mafia) await m.send("🕶️ **ENMAFIA:** You are the **MAFIA**. Don't get caught.");
            for (const v of shuffled) await v.send("🌾 **ENMAFIA:** You are a **VILLAGER**. Watch your back.");

            // Create Private Den
            const den = await interaction.guild.channels.create({
                name: '🏮-mafia-den',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...mafia.map(m => ({ id: m.id, allow: [PermissionFlagsBits.ViewChannel] }))
                ]
            });
            game.mafiaChannelId = den.id;
            await interaction.reply(`🌙 Night falls. Check DMs. The ${den} has been established.`);
        }

        if (interaction.commandName === 'end') {
            if (game.mafiaChannelId) {
                const chan = await interaction.guild.channels.fetch(game.mafiaChannelId);
                if (chan) await chan.delete();
            }
            game.players = [];
            await interaction.reply("🛑 Game over. Evidence cleared.");
        }
    }
});

client.login(process.env.DISCORD_TOKEN);