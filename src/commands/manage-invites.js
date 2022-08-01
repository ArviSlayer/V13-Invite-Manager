const { Client, MessageEmbed, Message, MessageButton, MessageReaction, MessageActionRow, MessageComponentInteraction } = require('discord.js');
const db = require('quick.db');
const { colors, fromIntToDate, codeGenerator } = require('discord-toolbox');
const config = require('../../config.json');
const moment = require('moment');
const translate = require('../manager');

/**
 * @param {Client} client 
 * @param {Message} msg
 * @param {string[]} args
 */
const run = async (client, msg, args) => {
    if(!msg.member.permissions.has("MANAGE_GUILD")) return client.sendError(msg, translate("Bu Komutu KullanmaK İçin Yeterli Yetkin Yok...", "You Do Not Have Permissions To Use This Command"));
    let member = args[0] ? msg.mentions.members.first() || msg.guild.members.cache.get(args[0]) : msg.member;
    if(!member || member.user.bot) return client.sendError(msg, translate("Üye Bulunamadı...", "No Members Were Found..."));
    
    let tooLateEmbed = new MessageEmbed()
        .setColor(colors.red)
        .setDescription(`⏱️ - ${msg.author.toString()}, ${translate("cevap Vermen Çok Uzun Sürdü...", "You Took Too Long To Respond...")}`)
    let actionEmbed = new MessageEmbed()
        .setColor(colors.yellow)
        .setDescription(
            `💢 - ` + translate("**Ne Yapmak İstiyorsun?**", "**What Do You Want To Do?**")
        )
    let addButtonID = codeGenerator(50);
    let addButton = new MessageButton()
        .setCustomId(addButtonID)
        .setStyle("SUCCESS")
        .setLabel(translate("Ekle", "ADD"))
    let removeButtonID = codeGenerator(50);
    let removeButton = new MessageButton()
        .setCustomId(removeButtonID)
        .setStyle("DANGER")
        .setLabel(translate("Çıkar", "REMOVE"))
    let buttonsActionRaw = new MessageActionRow()
        .addComponents([addButton, removeButton]);
    
    let message = await msg.reply({ embeds: [actionEmbed], components: [buttonsActionRaw] });

    let action = "";
    let nextStep = true;
    await message.awaitMessageComponent({
        filter: (interaction) => {
            return interaction.user.id == msg.author.id && interaction.isButton();
        }, time: 30000
    }).then((interaction) => {
        switch(interaction.customId) {
            case addButtonID: action = "add";
            break; case removeButtonID: action = "subtract";
            break;
        }; interaction.deferUpdate();
    }).catch(() => {
        nextStep = false;
        message.edit({ embeds: [tooLateEmbed] });
    }); if(!nextStep) return;

    let amountEmbed = new MessageEmbed()
        .setColor(colors.yellow)
        .setDescription((action == "add" ? "📈" : "📉") + " - " + translate(`**Kaç Davet İstersin? ${action == "add" ? "ekle" : "çıkar"} ?**`, `**How Many Invites Do You Want To? ${action} ?**`))
    await message.edit({ embeds: [amountEmbed], components: [] });
    
    let amount = await msg.channel.awaitMessages({
        filter: (m) => {
            return m.author.id == msg.author.id && Math.abs(parseInt(m.content)) > 0;
        }, max: 1,
        time: 30000,
        errors: ["time"]
    }).then(collected => {
        collected.first().delete();
        return Math.abs(parseInt(collected.first().content));
    }).catch(() => {
        nextStep = false;
        return message.edit({ embeds: [tooLateEmbed], components: [] });
    }); if(!nextStep) return;

    if(isNaN(amount)) return message.edit({ content: translate("🧐 - **Hoop! Bir Şyler Ters Gitti...**", "🧐 - **Oops, Something Went Wrong...**"), embeds: [], components: [] });

    let reason = undefined;
    nextStep = false;
    let skipReason = false;
    let askReasonEmbed = new MessageEmbed()
        .setColor(colors.yellow)
        .setDescription(translate(`❓ - **Ne Yapmak İstiyorsun?  ${action == 'add' ? "ekle" : "çıkar"} **`, `❓ - **Why Do You Want To? ${action == "add" ? "add" : "remove"} Invites To ${member.user.toString()} ?**`))
    let skipReasonButtonID = codeGenerator(50);
    let skipReasonButton = new MessageButton()
        .setCustomId(skipReasonButtonID)
        .setStyle("SECONDARY")
        .setLabel(translate("Geç", "Skip"))
    let skipReasonActionRaw = new MessageActionRow()
        .addComponents([skipReasonButton])
    
    await message.edit({ embeds: [askReasonEmbed], components: [skipReasonActionRaw] });

    await Promise.race([
        msg.channel.awaitMessages({
            filter: (m) => {
                return m.author.id == msg.author.id;
            }, max: 1,
            time: 40000,
            errors: ["time"]
        }).then((collected) => {
            nextStep = true;
            reason = collected.first().content;
        }).catch(() => {})
        ,
        message.awaitMessageComponent({
            filter: (interaction) => {
                return interaction.user.id == msg.author.id && interaction.isButton() && interaction.customId == skipReasonButtonID;
            }, time: 40000
        }).then((interaction) => {
            interaction.deferUpdate();
            nextStep = true;
            skipReason = true;
        }).catch(() => {})
    ]); if(!nextStep) return message.edit({ embeds: [tooLateEmbed], components: [] });

    if(!db.has(`users.${member.user.id}.bonusHistory`)) {
        db.set(`users.${member.user.id}.bonusHistory`, []);
    }; db.push(`users.${member.user.id}.bonusHistory`, {
        by: msg.author.id,
        at: new Date().setHours(new Date().getHours() +2),
        amount: amount,
        action: action,
        reason: reason
    });
    db[action](`users.${member.user.id}.invites.bonus`, amount);
    let doneEmbed = new MessageEmbed()
        .setColor(colors.green)
        .setDescription(`✅ - ${msg.author.toString()}, **${amount.toLocaleString("tr")}** ${translate(`Davetler Eklendi ${action == "add" ? "ekle" : "çıkar"} - ${member.user.toString()}`, `Invites Has Been ${action}ed From ${member.user.toString()}`)}`)
    return message.edit({ embeds: [doneEmbed], components: [] })
};

module.exports = {
    aliases: ["mi"],
    description: "Davet Eklemenizi Veya Çıkarmanızı Sağlar",
    run: run
};