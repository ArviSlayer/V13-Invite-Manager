require('dotenv').config();
const db = require('quick.db');
const { Client, Intents, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const client = new Client({ intents: ["GUILDS", "GUILD_INVITES", "GUILD_MEMBERS", "GUILD_MESSAGES"], partials: ["CHANNEL", "GUILD_MEMBER", "MESSAGE", "USER"] });
client.commands = new Collection();

fs.readdirSync(path.resolve(process.cwd(), "src", "commands"))
.filter(c => c.endsWith(".js"))
.forEach(f => {
    let command = require(`./commands/${f}`);
    client.commands.set(f.split(".js")[0], {
        name: f.split(".js")[0],
        aliases: command.aliases,
        description: command.description,
        run: command.run
    });
});
fs.readdirSync(path.resolve(process.cwd(), "src", "events"))
.filter(e => e.endsWith(".js"))
.forEach(f => {
    client.on(f.split(".js")[0], (x,y) => require(`./events/${f}`)(client, x, y));
});

client.sendError = (msg, content) => {
    return msg.reply({ content: `🧐 - **${content}**`, components: [] });
}; client.editError = (msg, content) => {
    return msg.edit({ content: `🧐 - **${content}**`, components: [] });
}

client.login("BOT TOKENİNİZİ GİRİN");
