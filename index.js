const { Client, GatewayIntentBits, ChannelType, Events, Partials } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

const OWNER_ID = '976171719616237589'; 
const USER_ID_DELIMITER = "||--DM-FORWARD-USER-ID--||"; 
const TARGET_GUILD_ID = '1434541357241995297'; 

const token = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_NAME = 'onsdagshygge'; 

const timeZone = 'Europe/Copenhagen'; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message], 
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`ready.login.${readyClient.user.tag}`);
    console.log(`ready.timezone.${timeZone}`);
    console.log(`ready.target_guild.${TARGET_GUILD_ID}`);
    console.log(`ready.target_channel.${TARGET_CHANNEL_NAME}`);

    const cronDay = 4
    const cronHour = 12
    const cronMinute = 0

    cron.schedule(`${cronMinute} ${cronHour} * * ${cronDay}`, () => {
        console.log('execute.cron');
        createWeeklyOnsdagshyggePost();
    }, {
        scheduled: true,
        timezone: timeZone,
    });

    console.log(`ready.cron.${cronHour}.${cronMinute}.${cronDay}`);
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM && message.author.id !== OWNER_ID) {
        try {
            const owner = await client.users.fetch(OWNER_ID);

            const forwardedMessage = 
                `**${message.author.tag}**: ${message.content}` + 
                `\n\n${USER_ID_DELIMITER}${message.author.id}`; 
            
            await owner.send(forwardedMessage);
            
            console.log(`dm.forwarded.${message.author.tag}`);

        } catch (error) {
            console.error('error.dm.forward'); 
            if (message.channel) {
                 message.channel.send("Der opstod en fejl under videresendelsen af din besked. Prøv igen senere.");
            }
        }
    }

    if (message.author.id === OWNER_ID && message.channel.type === ChannelType.DM) {
        
        if (!message.reference) {
            return; 
        }

        let referenceMessage;
        try {
            referenceMessage = await message.channel.messages.fetch(message.reference.messageId);
        } catch (e) {
            console.error("error.fetch.reference");
            return message.author.send("⚠️ Fejl: Kunne ikke hente den besked, du forsøger at svare på.");
        }
        
        if (referenceMessage.author.id !== client.user.id) {
            return;
        }

        if (!referenceMessage.content.includes(USER_ID_DELIMITER)) {
             return message.author.send(`⚠️ Fejl: Kan ikke finde bruger-ID i den besked, du svarer på.`);
        }

        const contentParts = referenceMessage.content.split(USER_ID_DELIMITER);

        if (contentParts.length < 2) {
            return message.author.send(`⚠️ Fejl: Kunne ikke udtrække bruger-ID fra afgrænseren.`);
        }

        const targetUserId = contentParts[1].trim(); 
        
        if (!/^\d+$/.test(targetUserId)) {
            return message.author.send(`⚠️ Fejl: Det udtrukne ID (${targetUserId}) er ikke gyldigt.`);
        }

        const replyContent = message.content.trim(); 
        
        if (!replyContent) {
            return message.author.send("Du kan ikke sende et tomt svar.");
        }
        
        try {
            const targetUser = await client.users.fetch(targetUserId);
            
            const finalReply = `**Ejeren**: ${replyContent}`;

            await targetUser.send(finalReply);
            
            await message.author.send(`✅ Svar sendt til **${targetUser.tag}**:\n> ${replyContent}`);

            console.log(`dm.reply.sent.${targetUser.tag}`);

        } catch (error) {
            console.error('error.dm.reply');
            message.author.send(`Der opstod en fejl under afsendelse af svaret: ${error.message}`);
        }
    }
});

function getNextWednesdayDate() {
    const now = new Date();
    const nowInCopenhagen = new Date(
        now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })
    );
    const currentDay = nowInCopenhagen.getDay(); 
    const WEDNESDAY = 3;
    let daysUntilWednesday = (WEDNESDAY - currentDay + 7) % 7;
    if (daysUntilWednesday === 0) daysUntilWednesday = 7; 
    const nextWednesday = new Date(nowInCopenhagen);
    nextWednesday.setDate(nowInCopenhagen.getDate() + daysUntilWednesday);
    const day = nextWednesday.getDate().toString().padStart(2, '0');
    const month = (nextWednesday.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
}

async function createWeeklyOnsdagshyggePost() {
    try {
        const guild = client.guilds.cache.get(TARGET_GUILD_ID);
        
        if (!guild) {
            console.error('error.guild.notfound');
            return;
        }

        const channel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildForum && c.name.toLowerCase() === TARGET_CHANNEL_NAME
        );

        if (!channel) {
            console.error('error.channel.notfound');
            return;
        }

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
        console.error('error.post.new');
    }
}

client.login(token);