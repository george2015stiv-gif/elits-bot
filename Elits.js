const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');
const express = require('express');

// Express Server για να κρατάει το Render το Web Service Live 24/7
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('THE ELITS Bot is Online & Running 24/7!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// Διαβάζει το TOKEN & CLIENT_ID από τα Environment Variables του Render
const TOKEN = process.env.TOKEN || 'MTUzNDUzNDUxNzI4MzYxODgxNg.GUnHO0.FYyWURTpOq5ui6wX8IAZfMISxhHHwkK8Xbcu_o';
const CLIENT_ID = process.env.CLIENT_ID || '1534534517283618816';

// --- CHANNEL IDs ---
const CHANNELS = {
    MOD_LOGS: '1518563167880613980',
    VERIFY: '1518904063520014396',
    COMMANDS: '1509823803759525898',
    EVENTS: '1509823803759525898',
    CODES: '1508126924348592259',
    ANNOUNCEMENTS: '1508126924348592259'
};

// --- SMART AUTO-MOD DICTIONARY & PATTERNS ---
const BAN_WORDS = ['panagia', 'panagias', 'xristos', 'xristou', 'theos', 'theou', 'παναγια', 'παναγιας', 'χριστος', 'χριστου', 'θεος', 'θεου'];
const KICK_WORDS = ['spiti', 'spitia', 'mana', 'manas', 'oikogeneia', 'σπιτι', 'σπιτια', 'μανα', 'μανας', 'οικογενεια'];
const TIMEOUT_WORDS = ['gamw', 'gamo', 'gamousa', 'γαμω', 'γαμώ', 'γαμουσα'];

function normalizeText(text) {
    return text.toLowerCase()
        .replace(/3/g, 'e')
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/@/g, 'a')
        .replace(/\$/g, 's')
        .replace(/[\s\._\-]/g, '');
}

// --- SLASH COMMANDS REGISTER ---
const commands = [
    new SlashCommandBuilder().setName('event').setDescription('Δημιουργία Event').addStringOption(o=>o.setName('title').setDescription('Τίτλος').setRequired(true)).addStringOption(o=>o.setName('description').setDescription('Περιγραφή').setRequired(true)).addStringOption(o=>o.setName('location').setDescription('Πού').setRequired(true)).addIntegerOption(o=>o.setName('minutes').setDescription('Λεπτά').setRequired(true)).addStringOption(o=>o.setName('image').setDescription('Εικόνα').setRequired(false)),
    new SlashCommandBuilder().setName('anevent').setDescription('Ανακοίνωση Event').addStringOption(o=>o.setName('message').setDescription('Μήνυμα').setRequired(true)),
    new SlashCommandBuilder().setName('announce').setDescription('Γενική Ανακοίνωση').addStringOption(o=>o.setName('title').setDescription('Τίτλος').setRequired(true)).addStringOption(o=>o.setName('message').setDescription('Περιεχόμενο').setRequired(true)),
    new SlashCommandBuilder().setName('drop').setDescription('Drop Roulette & Challenge'),
    new SlashCommandBuilder().setName('bounty').setDescription('Βάλε επικήρυξη').addUserOption(o=>o.setName('target').setDescription('Παίκτης').setRequired(true)).addIntegerOption(o=>o.setName('coins').setDescription('Coins').setRequired(true)),
    new SlashCommandBuilder().setName('challenge').setDescription('1v1 Challenge').addUserOption(o=>o.setName('opponent').setDescription('Αντίπαλος').setRequired(true)),
    new SlashCommandBuilder().setName('findsquad').setDescription('Εύρεση συμπαικτών').addStringOption(o=>o.setName('mode').setDescription('Mode').setRequired(true)),
    new SlashCommandBuilder().setName('loadout').setDescription('Random Fortnite Loadout'),
    new SlashCommandBuilder().setName('compare').setDescription('Σύγκριση παικτών').addUserOption(o=>o.setName('player1').setDescription('Παίκτης 1').setRequired(true)).addUserOption(o=>o.setName('player2').setDescription('Παίκτης 2').setRequired(true)),
    new SlashCommandBuilder().setName('quests').setDescription('Daily ELITS Pass Quests'),
    new SlashCommandBuilder().setName('zonewars').setDescription('Zone Wars Map Code'),
    new SlashCommandBuilder().setName('quiz').setDescription('Fortnite Trivia Quiz'),
    new SlashCommandBuilder().setName('code').setDescription('Custom Lobby Code').addStringOption(o=>o.setName('key').setDescription('Κωδικός').setRequired(true)).addStringOption(o=>o.setName('mode').setDescription('Mode').setRequired(true)),
    new SlashCommandBuilder().setName('supplydrop').setDescription('Mystery Supply Drop'),
    new SlashCommandBuilder().setName('verify').setDescription('Auto Verify System')
];

if (TOKEN && TOKEN !== 'ΤΟ_BOT_TOKEN_ΣΟΥ') {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    (async () => {
        try {
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
            console.log('Όλα τα commands εγγράφηκαν επιτυχώς!');
        } catch (e) { console.error('Error registering commands:', e); }
    })();
}

// --- AI AUTO-MOD ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.channel.name && message.channel.name.includes('clips') && message.attachments.size > 0) {
        await message.react('🔥');
        await message.react('🤡');
        await message.react('🎯');
        return;
    }

    const rawContent = message.content;
    const cleanContent = normalizeText(rawContent);
    const member = message.member;

    let punishmentLevel = 0;
    let reasonCategory = '';

    if (BAN_WORDS.some(w => cleanContent.includes(w))) {
        punishmentLevel = 3;
        reasonCategory = 'Βρισιά σε Θεία / Χριστούς / Παναγίες';
    } else if (KICK_WORDS.some(w => cleanContent.includes(w))) {
        punishmentLevel = 2;
        reasonCategory = 'Βρισιά σε Σπίτι / Οικογένεια / Μάνα';
    } else if (TIMEOUT_WORDS.some(w => cleanContent.includes(w))) {
        punishmentLevel = 1;
        reasonCategory = 'Δυνατή βρισιά (Γαμώ)';
    }

    if (punishmentLevel > 0) {
        await message.delete().catch(() => {});
        let actionTaken = '';
        const reason = `[AI Auto-Mod] ${reasonCategory}`;

        try {
            if (punishmentLevel === 3) {
                await member.ban({ reason });
                actionTaken = '🔨 **ΑΠΟΚΛΕΙΣΜΟΣ (BAN)**';
            } else if (punishmentLevel === 2) {
                await member.kick(reason);
                actionTaken = '🚪 **ΕΚΔΙΩΞΗ (KICK)**';
            } else if (punishmentLevel === 1) {
                await member.timeout(10 * 60 * 1000, reason);
                actionTaken = '⏳ **ΔΙΑΛΕΙΜΜΑ (TIMEOUT 10 min)**';
            }
        } catch (err) {
            actionTaken = `⚠️ Αποτυχία επιβολής: ${err.message}`;
        }

        const logChannel = message.guild.channels.cache.get(CHANNELS.MOD_LOGS);
        const logEmbed = new EmbedBuilder()
            .setTitle('🛡️ AI AUTO-MOD PUNISHMENT DETECTED')
            .setColor(punishmentLevel === 3 ? 0x990000 : (punishmentLevel === 2 ? 0xFF6600 : 0xFFCC00))
            .addFields(
                { name: '👤 Χρήστης', value: `<@${member.id}> (${member.user.tag})`, inline: true },
                { name: '⚡ Ποινή', value: actionTaken, inline: true },
                { name: '🏷️ Κατηγορία', value: reasonCategory, inline: true },
                { name: '💬 Διαγραμμένο Μήνυμα', value: `\`\`\`${rawContent}\`\`\`` },
                { name: '📍 Κανάλι', value: `<#${message.channel.id}>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'THE ELITS AI Safety System' });

        if (logChannel) {
            await logChannel.send({ embeds: [logEmbed] });
        }
    }
});

// --- COMMAND HANDLERS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, channelId } = interaction;

    const enforceChannel = async (targetChannelId) => {
        if (channelId !== targetChannelId) {
            await interaction.reply({ 
                content: `⚠️ Αυτή η εντολή μπορεί να χρησιμοποιηθεί μόνο στο κανάλι <#${targetChannelId}>!`, 
                ephemeral: true 
            });
            return false;
        }
        return true;
    };

    if (commandName === 'event') {
        if (!await enforceChannel(CHANNELS.EVENTS)) return;
        const title = options.getString('title');
        const description = options.getString('description');
        const location = options.getString('location');
        const minutes = options.getInteger('minutes');
        const image = options.getString('image');

        let totalSeconds = minutes * 60;
        const participants = new Set();

        const formatTime = (sec) => {
            const h = Math.floor(sec / 3600).toString().padStart(2, '0');
            const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
            const s = (sec % 60).toString().padStart(2, '0');
            return `${h}:${m}:${s}`;
        };

        const buildEmbed = (timeString) => {
            const embed = new EmbedBuilder()
                .setTitle(`🏆 THE ELITS EVENT: ${title}`)
                .setDescription(description)
                .setColor(0xFF0000)
                .addFields(
                    { name: '📍 Τοποθεσία', value: location, inline: true },
                    { name: '⏳ Απομένουν', value: `\`${timeString}\``, inline: true },
                    { name: `👥 Συμμετέχοντες (${participants.size})`, value: participants.size > 0 ? Array.from(participants).map(id => `<@${id}>`).join(', ') : 'Κανένας ακόμα' }
                )
                .setFooter({ text: 'THE ELITS Bot' })
                .setTimestamp();
            if (image) embed.setImage(image);
            return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_event').setLabel('✅ Συμμετοχή').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('leave_event').setLabel('❌ Ακύρωση').setStyle(ButtonStyle.Danger)
        );

        const message = await interaction.reply({ embeds: [buildEmbed(formatTime(totalSeconds))], components: [buttons], fetchReply: true });

        const timer = setInterval(async () => {
            totalSeconds -= 3;
            if (totalSeconds <= 0) {
                clearInterval(timer);
                const endEmbed = EmbedBuilder.from(buildEmbed('00:00:00')).setTitle(`🎉 EVENT STARTS NOW: ${title}`).setColor(0x00FF00);
                await message.edit({ embeds: [endEmbed], components: [] });
            } else {
                await message.edit({ embeds: [buildEmbed(formatTime(totalSeconds))] }).catch(() => clearInterval(timer));
            }
        }, 3000);

        const collector = message.createMessageComponentCollector();
        collector.on('collect', async i => {
            if (i.customId === 'join_event') participants.add(i.user.id);
            if (i.customId === 'leave_event') participants.delete(i.user.id);
            await i.reply({ content: 'Ενημερώθηκε!', ephemeral: true });
            await message.edit({ embeds: [buildEmbed(formatTime(totalSeconds > 0 ? totalSeconds : 0))] });
        });
    }

    if (commandName === 'anevent') {
        if (!await enforceChannel(CHANNELS.ANNOUNCEMENTS)) return;
        const msg = options.getString('message');
        const embed = new EmbedBuilder().setTitle('🚨 ΑΝΑΚΟΙΝΩΣΗ EVENT 🚨').setDescription(msg).setColor(0xFFA500);
        await interaction.reply({ content: '@everyone', embeds: [embed] });
    }

    if (commandName === 'announce') {
        if (!await enforceChannel(CHANNELS.ANNOUNCEMENTS)) return;
        const title = options.getString('title');
        const msg = options.getString('message');
        const embed = new EmbedBuilder().setTitle(`📢 ${title}`).setDescription(msg).setColor(0x0099FF);
        await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'code') {
        if (!await enforceChannel(CHANNELS.CODES)) return;
        const key = options.getString('key');
        const mode = options.getString('mode');
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('reveal_code').setLabel('👁️ Αποκάλυψη Κωδικού').setStyle(ButtonStyle.Primary));
        const embed = new EmbedBuilder().setTitle(`🔒 CUSTOM CODE (${mode})`).setDescription('Πατήστε το κουμπί!').setColor(0x2C3E50);
        const msg = await interaction.reply({ embeds: [embed], components: [btn], fetchReply: true });
        const col = msg.createMessageComponentCollector();
        col.on('collect', async i => await i.reply({ content: `🔑 Κωδικός: **${key}**`, ephemeral: true }));
    }

    if (commandName === 'verify') {
        if (!await enforceChannel(CHANNELS.VERIFY)) return;
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_user').setLabel('⚔️ Αποδοχή Κανόνων').setStyle(ButtonStyle.Success));
        const embed = new EmbedBuilder().setTitle('📜 ΚΑΝΟΝΕΣ THE ELITS').setDescription('Πατήστε το κουμπί για είσοδο!').setColor(0x27AE60);
        const msg = await interaction.reply({ embeds: [embed], components: [btn], fetchReply: true });
        const col = msg.createMessageComponentCollector();
        col.on('collect', async i => await i.reply({ content: '✅ Επαληθευτήκατε επιτυχώς!', ephemeral: true }));
    }

    const generalCommands = ['drop', 'bounty', 'challenge', 'findsquad', 'loadout', 'compare', 'quests', 'zonewars', 'quiz', 'supplydrop'];
    if (generalCommands.includes(commandName)) {
        if (!await enforceChannel(CHANNELS.COMMANDS)) return;

        if (commandName === 'drop') {
            const locs = ['Classy Courts', 'Rebel\'s Roost', 'Fencing Fields', 'Snooty Steppes'];
            const chals = ['Μόνο Pistols & SMGs!', 'Χωρίς Shield/Potions!', 'Μόνο Shotguns!'];
            const embed = new EmbedBuilder().setTitle('🎯 Drop Roulette').addFields({ name: '📍 Location', value: locs[Math.floor(Math.random()*locs.length)] }, { name: '⚠️ Challenge', value: chals[Math.floor(Math.random()*chals.length)] }).setColor(0x9B59B6);
            await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'bounty') {
            const target = options.getUser('target');
            const coins = options.getInteger('coins');
            const embed = new EmbedBuilder().setTitle('💰 ΝΕΑ ΕΠΙΚΗΡΥΞΗ!').setDescription(`Ο <@${interaction.user.id}> έβαλε **${coins} Coins** στον <@${target.id}>!`).setColor(0xE74C3C);
            await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'challenge') {
            const opponent = options.getUser('opponent');
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('accept_1v1').setLabel('⚔️ Αποδοχή 1v1').setStyle(ButtonStyle.Danger));
            const embed = new EmbedBuilder().setTitle('⚔️ 1v1 ELO CHALLENGE').setDescription(`<@${interaction.user.id}> προκάλεσε τον <@${opponent.id}>!`).setColor(0xE67E22);
            await interaction.reply({ content: `<@${opponent.id}>`, embeds: [embed], components: [btn] });
        }
        if (commandName === 'findsquad') {
            const mode = options.getString('mode');
            const channel = await interaction.guild.channels.create({ name: `[ELITS] ${mode}`, type: 2 });
            await interaction.reply({ content: `✅ Δημιουργήθηκε Voice Channel: ${channel}` });
        }
        if (commandName === 'loadout') {
            const embed = new EmbedBuilder().setTitle('🎒 RANDOM LOADOUT').addFields({ name: '🔫 Shotgun', value: 'Gatekeeper' }, { name: '🔫 AR', value: 'Warforged' }).setColor(0x1ABC9C);
            await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'compare') {
            const p1 = options.getUser('player1');
            const p2 = options.getUser('player2');
            const embed = new EmbedBuilder().setTitle(`📈 ${p1.username} VS ${p2.username}`).addFields({ name: p1.username, value: '🏆 Wins: 140 | K/D: 3.4', inline: true }, { name: p2.username, value: '🏆 Wins: 115 | K/D: 2.9', inline: true }).setColor(0x34495E);
            await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'quests') {
            const embed = new EmbedBuilder().setTitle('🎟️ ELITS PASS QUESTS').setDescription('1. 🏆 1 Win (+300 XP)\n2. 🎙️ 30m Voice (+150 XP)').setColor(0xF1C40F);
            await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'zonewars') {
            const embed = new EmbedBuilder().setTitle('🗺️ Zone Wars Map').setDescription('Code: `1234-5678-9012`').setColor(0x3498DB);
            await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'quiz') {
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('q_right').setLabel('185 HP').setStyle(ButtonStyle.Secondary));
            const embed = new EmbedBuilder().setTitle('🎯 QUIZ').setDescription('Headshot damage Gold Havoc Pump;').setColor(0x913D88);
            await interaction.reply({ embeds: [embed], components: [btn] });
        }
        if (commandName === 'supplydrop') {
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_drop').setLabel('📦 Άνοιγμα Supply Drop').setStyle(ButtonStyle.Success));
            const embed = new EmbedBuilder().setTitle('⚠️ SUPPLY DROP!').setDescription('Πατήστε πρώτοι για 500 Coins!').setColor(0xF39C12);
            const msg = await interaction.reply({ embeds: [embed], components: [btn], fetchReply: true });
            const col = msg.createMessageComponentCollector();
            col.on('collect', async i => {
                await i.reply({ content: `🎉 Ο <@${i.user.id}> κέρδισε 500 Coins!` });
                await msg.edit({ components: [] });
            });
        }
    }
});

client.login(TOKEN);