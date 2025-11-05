// Importer nødvendige moduler
const { Client, GatewayIntentBits, ChannelType, Events } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// Konfiguration fra .env
const token = process.env.DISCORD_TOKEN;
const forumChannelId = process.env.FORUM_CHANNEL_ID;

const timeZone = 'Europe/Copenhagen'; // Dansk tid

// Opret en ny Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Når botten er klar og online
client.once(Events.ClientReady, (readyClient) => {
    console.log(`ready.login.${readyClient.user.tag}`);
    console.log(`ready.timezone.${timeZone}`);

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
        const channel = await client.channels.fetch(forumChannelId);

        if (!channel) {
            console.error(`error.channel.notfound.${forumChannelId}`);
            return;
        }

        if (channel.type !== ChannelType.GuildForum) {
            console.error(`error.channel.notforum.${forumChannelId}`);
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
        console.error('error.post.new', error);
    }
}

// Log botten ind
client.login(token);