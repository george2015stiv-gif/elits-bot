const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => console.log('Keep-alive server ready.'));
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus 
} = require('@discordjs/voice');

const { QuickDB } = require('quick.db');
const db = new QuickDB();
const gTTS = require('gtts');
const path = require('path');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// --- ΡΥΘΜΙΣΕΙΣ SERVER & ROLES ---
const CONFIG = {
  OPEN_DUTY_CHANNEL_ID: "1514346458982256733",
  CALL_ADMIN_VOICE_ID: "1515679294448341112",
  STAFF_CATEGORY_ID: "1515679112356954162",
  MUTED_ROLE_ID: "1515056918786347290",

  DUTY_LOG_CHANNELS: {
    STAFF: "1514489223095259216",
    POLICE: "1514489666785644604",
    EKAV: "1514489702617579580"
  },

  JOB_ROLES: {
    // Staff / Admin
    "1508123040108646591": { category: "STAFF", title: "Owner" },
    "1508122550142636143": { category: "STAFF", title: "Staff" },
    "1508324451727573032": { category: "STAFF", title: "Co-Staff" },
    
    // ΕΚΑΒ / Υγεία
    "1508323961258115154": { category: "EKAV", title: "Υπουργός Υγείας" },
    "1508128949966868511": { category: "EKAV", title: "ΕΚΑΒ" },
    "1508324862530420807": { category: "EKAV", title: "Ομαδάρχης ΕΚΑΒ" },
    "1508325002120921149": { category: "EKAV", title: "Γιατρός" },

    // Αστυνομία / ΕΛ.ΑΣ.
    "1508412052807487638": { category: "POLICE", title: "Αρχηγός ΕΛ.ΑΣ." },
    "1508412059401064458": { category: "POLICE", title: "Υπαρχηγός / Ο.Π.Κ.Ε." },
    "1508411809705623582": { category: "POLICE", title: "ΕΚΑΜ / ΤΑΕ" }
  }
};

function createTTSResource(text) {
  return new Promise((resolve, reject) => {
    const gtts = new gTTS(text, 'el');
    const filePath = path.join(__dirname, `tts_${Date.now()}.mp3`);
    gtts.save(filePath, (err) => {
      if (err) return reject(err);
      resolve({ resource: createAudioResource(filePath), filePath });
    });
  });
}

// --- BAD WORDS & PENALTY MONITORING ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const badWords = await db.get(`badwords_${message.guild.id}`) || [];
  const content = message.content.toLowerCase();
  
  if (badWords.some(w => content.includes(w.toLowerCase()))) {
    await message.delete().catch(() => {});
    
    await db.set(`penalty_${message.guild.id}_${message.author.id}`, {
      type: 'Ban (Bad Word)',
      duration: '2 Ημέρες',
      reason: 'Χρήση απαγορευμένης λέξης'
    });

    const member = await message.guild.members.fetch(message.author.id);
    if (CONFIG.MUTED_ROLE_ID) await member.roles.add(CONFIG.MUTED_ROLE_ID).catch(() => {});

    try {
      await message.author.send(`⚠️ **Έλαβες ποινή 2 ημερών Ban στον server ${message.guild.name}!**\n**Αιτία:** Χρήση απαγορευμένης λέξης.`);
    } catch (e) {}

    return message.channel.send(`<@${message.author.id}>, το μήνυμα διαγράφηκε και σου επιβλήθηκε ποινή 2 ημερών.`).then(m => setTimeout(() => m.delete(), 4000));
  }

  const penalty = await db.get(`penalty_${message.guild.id}_${message.author.id}`);
  if (penalty) {
    await message.delete().catch(() => {});

    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('view_penalty')
        .setLabel('Δες την ποινή σου')
        .setStyle(ButtonStyle.Danger)
    );

    const warn = await message.channel.send({
      content: `<@${message.author.id}> Έχεις ενεργή ποινή και δεν μπορείς να στείλεις μήνυμα!`,
      components: [btn]
    });
    setTimeout(() => warn.delete().catch(() => {}), 5000);
  }
});

// --- BUTTON INTERACTION ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'view_penalty') {
    const penalty = await db.get(`penalty_${interaction.guild.id}_${interaction.user.id}`);
    if (!penalty) return interaction.reply({ content: 'Δεν βρέθηκε ενεργή ποινή.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('⛔ Ενεργή Ποινή')
      .setColor('#FF0000')
      .addFields(
        { name: 'Τύπος Ποινής', value: `${penalty.type}`, inline: true },
        { name: 'Διάρκεια / Ποσό', value: `${penalty.duration || penalty.amount || 'Μόνιμο'}`, inline: true },
        { name: 'Αιτιολογία', value: `${penalty.reason}` }
      )
      .setFooter({ text: 'Σε περίπτωση ένστασης επικοινωνήστε με τον Owner. Η ποινή αφαιρείται μόνο από Admin.' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// --- VOICE LOGIC ---
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channelId === CONFIG.CALL_ADMIN_VOICE_ID && oldState.channelId !== CONFIG.CALL_ADMIN_VOICE_ID) {
    const guild = newState.guild;
    const member = newState.member;

    const tempChannel = await guild.channels.create({
      name: `${member.displayName}'s support`,
      type: ChannelType.GuildVoice,
      parent: CONFIG.STAFF_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
      ]
    });

    await member.voice.setChannel(tempChannel);

    const connection = joinVoiceChannel({
      channelId: tempChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const { resource: tts1, filePath: fp1 } = await createTTSResource("Γεια σας, έχετε καλέσει την ανώτατη διοίκηση των The Elits, παρακαλώ περιμένετε.");
    player.play(tts1);

    player.on(AudioPlayerStatus.Idle, async () => {
      if (fs.existsSync(fp1)) fs.unlinkSync(fp1);

      const activeDuty = await db.get(`onduty_${guild.id}`) || {};
      const hasStaff = Object.keys(activeDuty).length > 0;

      if (!hasStaff) {
        const { resource: ttsNoStaff, filePath: fpNoStaff } = await createTTSResource("Κανένα staff ή owner δεν είναι σε υπηρεσία.");
        player.play(ttsNoStaff);
        player.on(AudioPlayerStatus.Idle, () => {
          if (fs.existsSync(fpNoStaff)) fs.unlinkSync(fpNoStaff);
          connection.destroy();
        });
      } else {
        if (fs.existsSync('./cosmote.mp3')) {
          player.play(createAudioResource('./cosmote.mp3'));
        }
      }
    });

    const voiceListener = async (oldV, newV) => {
      if (newV.channelId === tempChannel.id && !newV.member.user.bot && newV.member.id !== member.id) {
        if (fs.existsSync('./beep.mp3')) {
          player.play(createAudioResource('./beep.mp3'));
          player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
            client.off('voiceStateUpdate', voiceListener);
          });
        } else {
          connection.destroy();
          client.off('voiceStateUpdate', voiceListener);
        }
      }
    };
    client.on('voiceStateUpdate', voiceListener);
  }

  if (oldState.channel && oldState.channel.name.endsWith("'s support") && oldState.channel.members.size === 0) {
    await oldState.channel.delete().catch(() => {});
  }
});

// --- REGISTER COMMANDS ---
client.on('ready', async () => {
  console.log(`🤖 Bot Online ως ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('openduty').setDescription('Μπες ή βγες από την υπηρεσία').addStringOption(o => o.setName('status').setDescription('Επίλεξε').setRequired(true).addChoices({ name: 'On Duty', value: 'on' }, { name: 'Off Duty', value: 'off' })),
    new SlashCommandBuilder().setName('b').setDescription('Ποινή Ban').addStringOption(o => o.setName('name').setDescription('Όνομα / Mention').setRequired(true)).addIntegerOption(o => o.setName('days').setDescription('Ημέρες').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Λόγος').setRequired(true)),
    new SlashCommandBuilder().setName('p').setDescription('Ποινή Perma Ban').addStringOption(o => o.setName('name').setDescription('Όνομα / Mention').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Λόγος').setRequired(true)),
    new SlashCommandBuilder().setName('j').setDescription('Ποινή Jail').addStringOption(o => o.setName('name').setDescription('Όνομα / Mention').setRequired(true)).addIntegerOption(o => o.setName('minutes').setDescription('Λεπτά').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Λόγος').setRequired(true)),
    new SlashCommandBuilder().setName('r').setDescription('Ποινή Πρόστιμο').addStringOption(o => o.setName('name').setDescription('Όνομα / Mention').setRequired(true)).addIntegerOption(o => o.setName('coins').setDescription('Coins').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Λόγος').setRequired(true)),
    new SlashCommandBuilder().setName('s').setDescription('Ποινή Σκούπες').addStringOption(o => o.setName('name').setDescription('Όνομα / Mention').setRequired(true)).addIntegerOption(o => o.setName('count').setDescription('Σκούπες').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Λόγος').setRequired(true)),
    new SlashCommandBuilder().setName('unb').setDescription('Αφαιρεί το Ban').addUserOption(o => o.setName('user').setDescription('Χρήστης').setRequired(true)),
    new SlashCommandBuilder().setName('unp').setDescription('Αφαιρεί το Perma Ban').addUserOption(o => o.setName('user').setDescription('Χρήστης').setRequired(true)),
    new SlashCommandBuilder().setName('unj').setDescription('Αφαιρεί το Jail').addUserOption(o => o.setName('user').setDescription('Χρήστης').setRequired(true)),
    new SlashCommandBuilder().setName('unr').setDescription('Αφαιρεί το Πρόστιμο').addUserOption(o => o.setName('user').setDescription('Χρήστης').setRequired(true)),
    new SlashCommandBuilder().setName('uns').setDescription('Αφαιρεί τις Σκούπες').addUserOption(o => o.setName('user').setDescription('Χρήστης').setRequired(true)),
    new SlashCommandBuilder().setName('seeb').setDescription('Δες τις ποινές ενός παίκτη').addUserOption(o => o.setName('user').setDescription('Χρήστης').setRequired(true)),
    new SlashCommandBuilder().setName('bad').setDescription('Προσθήκη Bad Word').addStringOption(o => o.setName('word').setDescription('Λέξη').setRequired(true)),
    new SlashCommandBuilder().setName('remove_bad').setDescription('Αφαίρεση Bad Word').addStringOption(o => o.setName('word').setDescription('Λέξη').setRequired(true)),
    new SlashCommandBuilder().setName('announce').setDescription('Επίσημη Ανακοίνωση').addStringOption(o => o.setName('text').setDescription('Κείμενο').setRequired(true))
  ];

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, "1508120097573834752"), { body: commands });
    console.log('✅ Όλες οι εντολές ενεργοποιήθηκαν!');
  } catch (e) { console.error(e); }
});

// --- SLASH COMMANDS LOGIC ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, member } = interaction;

  if (commandName === 'openduty') {
    if (interaction.channelId !== CONFIG.OPEN_DUTY_CHANNEL_ID) {
      return interaction.reply({ content: `Η εντολή εκτελείται μόνο στο κανάλι <#${CONFIG.OPEN_DUTY_CHANNEL_ID}>!`, ephemeral: true });
    }

    let userJob = null;
    for (const [roleId, jobData] of Object.entries(CONFIG.JOB_ROLES)) {
      if (member.roles.cache.has(roleId)) {
        userJob = jobData;
        break;
      }
    }

    if (!userJob) {
      return interaction.reply({ content: '❌ Δεν έχεις κάποιο επαγγελματικό ρόλο (Staff, EKAB, Αστυνομία) για να μπεις σε υπηρεσία!', ephemeral: true });
    }

    const targetChannelId = CONFIG.DUTY_LOG_CHANNELS[userJob.category];
    const logChannel = guild.channels.cache.get(targetChannelId);
    const status = options.getString('status');

    if (status === 'on') {
      await db.set(`onduty_${guild.id}.${member.id}`, true);
      const text = `🔴 **${userJob.title} ${member.displayName}** είναι σε υπηρεσία / **${userJob.title} ${member.displayName} is on duty**.`;
      if (logChannel) logChannel.send(text);
      return interaction.reply({ content: 'Μπήκες σε υπηρεσία!', ephemeral: true });
    } else {
      await db.delete(`onduty_${guild.id}.${member.id}`);
      const text = `⚪ **${userJob.title} ${member.displayName}** βγήκε από την υπηρεσία.`;
      if (logChannel) logChannel.send(text);
      return interaction.reply({ content: 'Βγήκες από την υπηρεσία!', ephemeral: true });
    }
  }

  if (['b', 'p', 'j', 'r', 's'].includes(commandName)) {
    const targetInput = options.getString('name');
    const reason = options.getString('reason');

    const targetMember = guild.members.cache.find(m => m.displayName === targetInput || m.user.username === targetInput || m.id === targetInput.replace(/[<@!>]/g, ''));
    if (!targetMember) return interaction.reply({ content: 'Ο χρήστης δεν βρέθηκε!', ephemeral: true });

    let pData = { reason, date: new Date().toLocaleDateString('el-GR') };
    if (commandName === 'b') { pData.type = 'Ban'; pData.duration = `${options.getInteger('days')} Ημέρες`; }
    if (commandName === 'p') { pData.type = 'Permanent Ban'; pData.duration = 'Για πάντα'; }
    if (commandName === 'j') { pData.type = 'Jail'; pData.duration = `${options.getInteger('minutes')} Λεπτά`; }
    if (commandName === 'r') { pData.type = 'Πρόστιμο'; pData.amount = `${options.getInteger('coins')} Coins`; }
    if (commandName === 's') { pData.type = 'Σκούπες'; pData.amount = `${options.getInteger('count')} Σκούπες`; }

    await db.set(`penalty_${guild.id}_${targetMember.id}`, pData);
    if (CONFIG.MUTED_ROLE_ID) await targetMember.roles.add(CONFIG.MUTED_ROLE_ID).catch(() => {});

    try {
      await targetMember.send(`⚠️ **Έλαβες ποινή στον server ${guild.name}!**\n**Τύπος:** ${pData.type}\n**Διάρκεια/Ποσό:** ${pData.duration || pData.amount}\n**Αιτία:** ${reason}\n\n*Σε περίπτωση ένστασης επικοινωνήστε με τον Owner.*`);
    } catch (e) {}

    return interaction.reply({ content: `✅ Η ποινή καταχωρήθηκε στον/στην **${targetMember.displayName}** και του/της στάλθηκε DM.` });
  }

  if (['unb', 'unp', 'unj', 'unr', 'uns'].includes(commandName)) {
    const targetUser = options.getUser('user');
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    await db.delete(`penalty_${guild.id}_${targetUser.id}`);
    if (targetMember && CONFIG.MUTED_ROLE_ID) {
      await targetMember.roles.remove(CONFIG.MUTED_ROLE_ID).catch(() => {});
    }

    try {
      await targetUser.send(`✅ **Η ποινή σου στον server ${guild.name} αφαιρέθηκε!**`);
    } catch (e) {}

    return interaction.reply({ content: `✅ Η ποινή για τον/την **${targetUser.username}** αφαιρέθηκε.` });
  }

  if (commandName === 'seeb') {
    const targetUser = options.getUser('user');
    const penalty = await db.get(`penalty_${guild.id}_${targetUser.id}`);

    if (!penalty) return interaction.reply({ content: `Ο χρήστης **${targetUser.username}** δεν έχει ενεργές ποινές.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`Ποινές Χρήστη: ${targetUser.username}`)
      .setColor('#FFA500')
      .addFields(
        { name: 'Τύπος', value: `${penalty.type}`, inline: true },
        { name: 'Διάρκεια / Ποσό', value: `${penalty.duration || penalty.amount || 'N/A'}`, inline: true },
        { name: 'Αιτία', value: `${penalty.reason}` }
      );

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'bad') {
    const word = options.getString('word');
    await db.push(`badwords_${guild.id}`, word);
    return interaction.reply({ content: `✅ Η λέξη \`${word}\` προστέθηκε στη μαύρη λίστα.`, ephemeral: true });
  }

  if (commandName === 'remove_bad') {
    const word = options.getString('word');
    let badWords = await db.get(`badwords_${guild.id}`) || [];
    badWords = badWords.filter(w => w !== word);
    await db.set(`badwords_${guild.id}`, badWords);
    return interaction.reply({ content: `✅ Η λέξη \`${word}\` αφαιρέθηκε από τη μαύρη λίστα.`, ephemeral: true });
  }

  if (commandName === 'announce') {
    const text = options.getString('text');
    const embed = new EmbedBuilder()
      .setTitle('📢 ΕΠΙΣΗΜΗ ΑΝΑΚΟΙΝΩΣΗ')
      .setDescription(text)
      .setColor('#00FF00')
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: 'Η ανακοίνωση στάλθηκε!', ephemeral: true });
  }
});

client.login(TOKEN);