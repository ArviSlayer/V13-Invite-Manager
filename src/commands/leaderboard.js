const { Client, MessageEmbed, Message, MessageButton, MessageActionRow } = require('discord.js');
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
    if(msg.author.bot) return;
    const users = Object.values(db.get("users"))
        .filter(u => msg.guild.members.cache.has(u.id))
        .sort((min,max) => Object.values(max.invites).reduce((x,y)=>x+y) - Object.values(min.invites).reduce((x,y)=>x+y));
    let pages = [];
    let temporaryPage = [];
    users.forEach((user, i) => {
        temporaryPage.push(user);
        if(temporaryPage.length == 10) { pages.push(temporaryPage); temporaryPage = [] };
        if(i == users.length-1 && temporaryPage.length > 0) { pages.push(temporaryPage); temporaryPage = [] };
    });
    pages = pages.map((page, i) => {
        let messageActionRaws = [];
        let embed = new MessageEmbed()
            .setColor(colors.yellow)
            .setAuthor(msg.guild.name, msg.guild.iconURL())
            .setDescription(
                (page.map((user, j) => `**${j+1+i*10}.** ${client.users.cache.get(user.id).toString()} - **${Object.values(user.invites).reduce((x,y)=>x+y).toLocaleString()} ${translate("Davetler", "invites")}** (**${user.invites.normal}** ${translate("Normal", "Regular")}, **${user.invites.left}** ${translate("Ayrılan", "Left")}, **${user.invites.fake}** ${translate("Sahte", "Fake")}, **${user.invites.bonus}** Bonus)`)
                .join("\n")) || "***Hiçbir üye derecelendirilmedi.***"
            ).setFooter(`${translate("İsteyen:", "Asked by:")} ${msg.member.nickname || msg.author.username} • Page ${(i+1).toLocaleString()}/${pages.length}`, msg.author.displayAvatarURL())
        var messageButtons = [];
        if(i > 0 && pages.length >= 10) {
            messageButtons.push(
                new MessageButton()
                    .setCustomId(`leaderboard_0`)
                    .setEmoji("⏪")
                    .setLabel("İlk Sayfa")
                    .setStyle("SECONDARY")
            )
        };if(i > 0) {
            messageButtons.push(
                new MessageButton()
                    .setCustomId(`leaderboard_${i-1}`)
                    .setEmoji("◀️")
                    .setLabel("Önceki Sayfa")
                    .setStyle("SECONDARY")
            )
        }; if(pages.length-i > 1) {
            messageButtons.push(
                new MessageButton()
                    .setCustomId(`leaderboard_${i+1}`)
                    .setEmoji("▶️")
                    .setLabel("Sonraki Sayfa")
                    .setStyle("SECONDARY")
            )
        }; if(pages.length-i > 1 && pages.length >= 10) {
            messageButtons.push(
                new MessageButton()
                    .setCustomId(`leaderboard_${pages.length-1}`)
                    .setEmoji("⏩")
                    .setLabel("Son Sayfa")
                    .setStyle("SECONDARY")
            )
        }; if(messageButtons.length > 0) {
            messageActionRaws.push(
                new MessageActionRow()
                    .addComponents(messageButtons)
            )
        }

        return { embeds: [embed], components: messageActionRaws };
    });

    let i = 0;
    while(i < pages.length) {
        let isClicked = false;
        let message = await msg.channel.send(pages[i]).catch(console.error);
        if(pages.length == 1) break;
        await message.awaitMessageComponent({
            filter: (interaction) => {
                return interaction.customId.startsWith("leaderboard") && interaction.user.id == msg.author.id && interaction.isButton();
            }, time: 30000
        }).then((interaction) => {
            i = parseInt(interaction.customId.split("_")[1]);
            return interaction.deferUpdate();
        }).catch(()=>'');
        if(!isClicked) {
            message.edit({ embeds: pages[i].embeds, components: [] });
            break;
        }
    };
};

module.exports = {
    aliases: ["lb"],
    description: "Davetlerin Sıralamasını Gösterir",
    run: run
};