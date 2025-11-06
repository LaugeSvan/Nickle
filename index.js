// Importer nødvendige moduler
const { Client, GatewayIntentBits, ChannelType, Events, Partials } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// --- KONFIGURATION ---
const OWNER_ID = '976171719616237589'; // Dit bruger-ID
// NYT: Meget lang, usandsynlig streng som afgrænser. 
// Dette sikrer, at Discord ikke forstyrrer den.
const USER_ID_DELIMITER = "||--DM-FORWARD-USER-ID--||"; 

// FJERN: forumChannelId er ikke længere nødvendig i .env
// const forumChannelId = process.env.FORUM_CHANNEL_ID;

const token = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_NAME = 'onsdagshygge'; // Det nye navn, der skal matches

const timeZone = 'Europe/Copenhagen'; // Dansk tid

// Opret en ny Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        // Intents for at modtage Direkte Beskeder
        GatewayIntentBits.DirectMessages,
    ],
    // Partials er nødvendige for pålidelig håndtering af DM'er og Replies.
    partials: [Partials.Channel, Partials.Message], 
});

// Når botten er klar og online
client.once(Events.ClientReady, (readyClient) => {
    console.log(`ready.login.${readyClient.user.tag}`);
    console.log(`ready.timezone.${timeZone}`);
    console.log(`ready.target_channel.${TARGET_CHANNEL_NAME}`);

    const cronDay = 4
    const cronHour = 12
    const cronMinute = 0

    // Kør hver torsdag kl. 12:00 dansk tid
    cron.schedule(`${cronMinute} ${cronHour} * * ${cronDay}`, () => {
        console.log('execute.onDay');
        createWeeklyOnsdagshyggePost();
    }, {
        scheduled: true,
        timezone: timeZone,
    });

    console.log(`ready.cron.${cronHour}.${cronMinute}.${cronDay}`);
});

// --- DM-HÅNDTERING ---

client.on(Events.MessageCreate, async message => {
    // Ignorer beskeder fra botten selv
    if (message.author.bot) return;

    // 1. HÅNDTER DM'ER FRA ANDRE BRUGERE TIL BOTTEN (VIDERESENDELSE)
    if (message.channel.type === ChannelType.DM && message.author.id !== OWNER_ID) {
        try {
            const owner = await client.users.fetch(OWNER_ID);

            // DET NYE MINIMALISTISKE FORMAT:
            const forwardedMessage = 
                `**${message.author.tag}**: ${message.content}` + // Synlig besked
                `\n\n${USER_ID_DELIMITER}${message.author.id}`; // Skjult ID til reference (i en ny linje)
            
            // Send DM'en til dig (ejeren)
            await owner.send(forwardedMessage);
            
            console.log(`dm.forwarded.${message.author.tag}`);

        } catch (error) {
            console.error('error.dm.forward', error);
            if (message.channel) {
                 message.channel.send("Der opstod en fejl under videresendelsen af din besked. Prøv igen senere.");
            }
        }
    }

// 2. HÅNDTER SVAREBESKEDER FRA DIG (EJEREN) I DM
    if (message.author.id === OWNER_ID && message.channel.type === ChannelType.DM) {
        
        // Ignorer, hvis det ikke er et svar.
        if (!message.reference) {
            return; 
        }

        // Hent den *originale* besked, som du forsøger at svare på
        let referenceMessage;
        try {
            referenceMessage = await message.channel.messages.fetch(message.reference.messageId);
        } catch (e) {
            console.error("error.fetch.reference", e);
            return message.author.send("⚠️ Fejl: Kunne ikke hente den besked, du forsøger at svare på.");
        }
        
        // Vi skal kun fortsætte, hvis du svarer på en besked, som botten selv har sendt
        if (referenceMessage.author.id !== client.user.id) {
            return;
        }

        // Tjek om den besked, du svarer på, indeholder den skjulte bruger-ID afgrænser
        if (!referenceMessage.content.includes(USER_ID_DELIMITER)) {
             return message.author.send(`⚠️ Fejl: Kan ikke finde bruger-ID i den besked, du svarer på.`);
        }

        // UDTRÆKNING RETTELSE: Vi splitter nu indholdet for at finde ID'et mere direkte
        const contentParts = referenceMessage.content.split(USER_ID_DELIMITER);

        if (contentParts.length < 2) {
            return message.author.send(`⚠️ Fejl: Kunne ikke udtrække bruger-ID fra afgrænseren.`);
        }

        // ID'et er den del, der kommer efter afgrænseren
        const targetUserId = contentParts[1].trim(); 
        
        // Valider at det er et numerisk ID
        if (!/^\d+$/.test(targetUserId)) {
            return message.author.send(`⚠️ Fejl: Det udtrukne ID (${targetUserId}) er ikke gyldigt.`);
        }

        const replyContent = message.content.trim(); // Hele beskeden er dit svar
        
        if (!replyContent) {
            return message.author.send("Du kan ikke sende et tomt svar.");
        }
        
        try {
            const targetUser = await client.users.fetch(targetUserId);
            
            // Svarformat: Simpelt, direkte svar.
            const finalReply = `**Ejeren**: ${replyContent}`;

            await targetUser.send(finalReply);
            
            // Bekræftelse til dig 
            await message.author.send(`✅ Svar sendt til **${targetUser.tag}**:\n> ${replyContent}`);

            console.log(`dm.reply.sent.${targetUser.tag}`);

        } catch (error) {
            console.error('error.dm.reply.', error);
            message.author.send(`Der opstod en fejl under afsendelse af svaret: ${error.message}`);
        }
    }
});

// --- FUNKTIONER TIL ONSDAGSHYGGE ---

function getNextWednesdayDate() {
    const now = new Date();
    // Konverter tid til dansk tidszone
    const nowInCopenhagen = new Date(
        now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })
    );
    const currentDay = nowInCopenhagen.getDay(); // 0 = søndag, 3 = onsdag
    const WEDNESDAY = 3;
    // Beregn dage til næste onsdag
    let daysUntilWednesday = (WEDNESDAY - currentDay + 7) % 7;
    if (daysUntilWednesday === 0) daysUntilWednesday = 7;
    const nextWednesday = new Date(nowInCopenhagen);
    nextWednesday.setDate(nowInCopenhagen.getDate() + daysUntilWednesday);
    const day = nextWednesday.getDate().toString().padStart(2, '0');
    const month = (nextWednesday.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
}

// Hovedfunktionen der opretter forum-posten
async function createWeeklyOnsdagshyggePost() {
    try {
        // Find den første guild (server) botten er i
        const guild = client.guilds.cache.first();
        if (!guild) {
            console.error('error.guild.noGuild.');
            return;
        }

        // Find Forum-kanalen ved navn 'onsdagshygge'
        const channel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildForum && c.name.toLowerCase() === TARGET_CHANNEL_NAME
        );

        if (!channel) {
            console.error(`error.channel.notFound.${guild.name}.#${TARGET_CHANNEL_NAME}`);
            return;
        }

        // Resten af logikken bruger nu den fundne 'channel'
        const formattedDate = getNextWednesdayDate();
        const postTitle = `${formattedDate} - Onsdagshygge`;
        const postMessage = 'Så er det tid igen! Ser vi dig på Onsdag til hygge, spil og kaffe? Forslag til hvad vi skal spille er meget velkomne!';
        
        const newPost = await channel.threads.create({
            name: postTitle,
            message: { content: postMessage },
            reason: 'Automatisk ugentlig onsdagshygge post',
        });
        
        console.log(`post.new.${postTitle}.${newPost.id}`);
        
        const starterMessage = await newPost.fetchStarterMessage();
        await starterMessage.react('✅');
        await starterMessage.react('❌');
        
        console.log('post.react');

    } catch (error) {
        console.error('error.post.new', error);
    }
}

// Log botten ind
client.login(token);