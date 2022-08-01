const { Client, MessageEmbed, Message } = require('discord.js');
const db = require('quick.db');
const { colors, fromIntToDate } = require('discord-toolbox');
const config = require('../../config.json');
const moment = require('moment');
const translate = require('../manager');

/**
 * @param {Client} client 
 * @param {Message} msg
 * @param {string[]} args
 */
const run = async (client, msg, args) => {
    let member = args[0] ? msg.mentions.members.first() || msg.guild.members.cache.get(args[0]) : msg.member;
    if(!member || member.user.bot) return client.sendError(msg, translate("Üye Bulunamadı...", "No Members Were Found..."));

    if(!db.has(`users.${member.user.id}`)) {
        db.set(`users.${member.user.id}`, {
            id: member.user.id,
            joins: [{
                at: member.joinedAt.setHours(member.joinedAt.getHours() +1),
                by: undefined,
                inviteCode: undefined
            }], bonusHistory: [],
            invites: {
                normal: 0,
                left: 0,
                fake: 0,
                bonus: 0
            }
        })
    }; let user = db.get(`users.${member.user.id}`);

    let rank = Object.values(db.get("users"))
        .sort((a,b) => Object.values(b.invites).reduce((x,y)=>x+y) - Object.values(a.invites).reduce((x,y)=>x+y))

    let embed = new MessageEmbed()
        .setColor(colors.yellow)
        .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
        .setDescription(
            `${member.user.id == msg.author.id ? translate("**Sahip Olduğun Davet Sayısı**", "**You Have**") : member.user.toString() + translate("Sahip", " Has")} **${Object.values(user.invites).reduce((x,y)=>x+y)}** ${translate("Davetler", "Invites")}.\n\n` +
            `✅ \`\`${user.invites.normal}\`\` **${translate("Davet Sayı", "Invited")}**\n` +
            `❌ \`\`${user.invites.left}\`\` **${translate("Ayrılan", "Left")}**\n` +
            `💩 \`\`${user.invites.fake}\`\` **${translate("Geçersiz", "Invalid")}**\n` +
            `✨ \`\`${user.invites.bonus}\`\` **Bonus**\n\n` 
            
        ).setFooter(`${translate("İsteyen", "Asked by")}: ${msg.author.tag}`, msg.author.displayAvatarURL({ format: "png" }))

    msg.channel.send({ embeds: [embed] });
};

module.exports = {
    aliases: ["inv"],
    description: "Davet Sayılarını Görmenizi Sağlar",
    run: run
};