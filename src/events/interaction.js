const { Client, MessageEmbed, Interaction, MessageButton, MessageActionRow } = require('discord.js');
const db = require('quick.db');
const { colors, fromIntToDate } = require('discord-toolbox');
const config = require('../../config.json');
const moment = require('moment');
const translate = require('../manager');

/**
 * @param {Client} client 
 * @param {Interaction} interaction 
 */

module.exports = async (client, interaction) => {
    if(!interaction.isButton()) return;
    if(interaction.customId.startsWith("invited-history") && interaction.customId.split("_")[2] == interaction.user.id) {
        const member = interaction.guild.members.cache.get(interaction.customId.split("_")[1]);
        const author = interaction.user;
        if(!member) return interaction.update({ content: translate("Üye Sunucudan Ayrıldı", "The Member Has Left The Server"), embeds: [], components: [] });

        let users = Object.values(db.get(`users`)).filter(u => u.joins?.map(j => j.by).includes(member.user.id));
        let invites = [];
        users.forEach((u) => {
            u.joins
            .filter(j => j.by == member.user.id)
            .forEach(j => {
                Object.assign(j, { id: u.id });
                invites.push(j);
            })
        });

        let backButton = new MessageButton()
            .setCustomId(`info_${member.user.id}_${interaction.customId.split("_")[2]}`)
            .setStyle("SECONDARY")
            .setLabel(translate("Üye Bilgilerine Geri Dön", "Back To The Members Infos"))
        let backButtonActionRaw = new MessageActionRow()
            .addComponents([backButton])

        let pages = [];
        let page = [];
        invites.sort((a,b) => b.at - a.at);
        let userUpdatedIDs = [];
        var definitiveInvites = [];
        invites.forEach(j => {
            let userDB = db.get(`users.${j.id}`)
            if(interaction.guild.members.cache.has(j.id)) {
                var left = false;
                if(userDB.joins[userDB.joins.length-1].by !== member.user.id) var fake = true;
                else if(userUpdatedIDs.includes(j.id)) var fake = true;
                else {
                    var fake = false;
                    userUpdatedIDs.push(j.id);
                };
            } else { var fake = false; var left = true; };
            definitiveInvites.push({
                at: j.at,
                by: j.by,
                inviteCode: j.inviteCode,
                id: j.id,
                fake: fake,
                left: left
            })
        });
        definitiveInvites.forEach(async (j) => {
            page.push(j);
            if(page.length >= 20) {
                let resolvedPage = await Promise.all(page.map(async (join) => {
                    let user = client.users.cache.get(join.id) || await client.users.fetch(join.id);
                    return `${join.left ? "❌" : join.fake ? "💩" : "✅"} ${user.toString()} - **${join.inviteCode}** - ${translate(`Önce **${fromIntToDate(Date.now() + 7200000 - join.at)}**`, `**${fromIntToDate(Date.now() + 7200000 - join.at, config.lang.toLowerCase())}** Ago`)}`;
                }));
                let pageEmbed = new MessageEmbed()
                    .setColor(colors.blue)
                    .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                    .setDescription(
                        resolvedPage.join("\n") || translate("❌ **Yok**", "❌ **Any**")
                    ).setFooter(`${translate("İsteyen", "Asked By")}: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
                pages.push(pageEmbed);
                page = [];
            };
        }); if(page.length > 0) {
            let resolvedPage = await Promise.all(page.map(async (join) => {
                let user = client.users.cache.get(join.id) || await client.users.fetch(join.id);
                return `${join.left ? "❌" : join.fake ? "💩" : "✅"} ${user.toString()} - **${join.inviteCode}** - ${translate(`Önce **${fromIntToDate(Date.now() +7200000 - join.at)}**`, `**${fromIntToDate(Date.now() +7200000 - join.at, config.lang.toLowerCase())}** Ago`)}`
            }));
            let pageEmbed = new MessageEmbed()
                .setColor(colors.blue)
                .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                .setDescription(
                    resolvedPage.join("\n") || translate("❌ **Yok**", "❌ **Asked by**")
                ).setFooter(`${translate("İsteyen", "Asked By")}: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
            pages.push(pageEmbed);
        };

        if(definitiveInvites.length == 0) {
            pages.push(
                new MessageEmbed()
                    .setColor(colors.red)
                    .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                    .setDescription(
                        `❌ - ${member.user.toString()} **${translate("Herhangi Bir Üye Davet Etmemiş", "Has Not Invited Any Member")}**`
                    ).setFooter(author.tag, author.displayAvatarURL({ format: "png" }))
            )
        }

        interaction.update({ embeds: pages, components: [backButtonActionRaw] });
    } else if(interaction.customId.startsWith("info") && interaction.customId.split("_")[2] == interaction.user.id) {
        const author = interaction.user;
        const member = interaction.guild.members.cache.get(interaction.customId.split("_")[1]);
        if(!member) return interaction.update({ content: "Üye Sunucudan Ayrıldı", embeds: [], components: [] });

        if(!db.has(`users.${member.user.id}`)) {
            db.set(`users.${member.user.id}`, {
                id: member.user.id,
                joins: [{
                    at: member.joinedAt.setHours(member.joinedAt.getHours() +1),
                    by: undefined,
                    inviteCode: undefined
                }],
                invites: {
                    normal: 0,
                    left: 0,
                    fake: 0,
                    bonus: 0
                }
            })
        }; let user = db.get(`users.${member.user.id}`);

        let regularInvites = `${member.user.id == interaction.customId.split("_")[2] ? translate("**Sahip Oldukların**", "**You Have**") : member.user.toString() + translate("Sahip", " Has")} **${Object.values(user.invites).reduce((x,y)=>x+y)}** ${translate("Davetler", "Invites")}.\n\n` +
        `✅ \`\`${user.invites.normal}\`\` **${translate("Davetler", "Invited")}**\n` +
        `❌ \`\`${Math.abs(user.invites.left)}\`\` **${translate("Ayrılanlar", "Left")}**\n` +
        `💩 \`\`${Math.abs(user.invites.fake)}\`\` **${translate("Geçersizler", "Invalid")}**\n` +
        `✨ \`\`${user.invites.bonus}\`\` **Bonus**`;

        let rank = Object.values(db.get("users"))
            .sort((a,b) => Object.values(b.invites).reduce((x,y)=>x+y) - Object.values(a.invites).reduce((x,y)=>x+y))
        
        let embed = new MessageEmbed()
            .setColor(colors.blue)
            .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
            .addField(
                translate("__Tarafından Davet Edildi__", "__Invited By__"),
                user.joins.length ? user.joins[user.joins.length-1].by == "vanity" ? "Özel URL" : user.joins[user.joins.length-1].by ? (client.users.cache.get(user.joins[user.joins.length-1].by) || await client.users.fetch(user.joins[user.joins.length-1].by)).toString() : translate("❌ **Introuvable**", "❌ **Not found**") : translate("❌ **Introuvable**", "❌ **Not found**"),
                true
            ).addField("\u200b", "\u200b", true)
            .addField(
                translate("__Rejoint le__", "__Joined On__"),
                moment.utc(member.joinedAt.setHours(member.joinedAt.getHours() +3)).format("DD/MM/YYYY à HH:mm:ss") + "\n" +
                translate(`Önce**${fromIntToDate(Date.now() - member.joinedTimestamp, "tr")}**`, `**${fromIntToDate(Date.now() - member.joinedTimestamp, "en")}** Ago`),
                true
            ).addField(
                translate("__Normal Davetler__", "__Regular Invites__"),
                regularInvites
            ).addField(
                translate("__Etkin Davetler__", "__Active Invites__"),
                Array.from(await interaction.guild.invites.fetch())
                .map(i => i[1])
                .filter(i => i.inviter.id == member.user.id)
                .sort((a,b) => b.createdTimestamp - a.createdTimestamp)
                .slice(0, 10)
                .map(i => {
                    return `**${i.code}** - ${i.channel.toString()} - ${translate(`Önce **${fromIntToDate(Date.now() - i.createdTimestamp, "tr")}**`, `**${fromIntToDate(Date.now() - i.createdTimestamp, "en")}** Ago`)}`
                }).join("\n") || translate("❌ **Yok**", "❌ **Any**")
            ).addField(
                translate("__Son Davet Edilen Üyeler__", "__Last Invited Members__"),
                Array.from(interaction.guild.members.cache)
                .map(i => i[1])
                .filter(m => db.has(`users.${m.user.id}`) && db.get(`users.${m.user.id}`).joins.length && db.get(`users.${m.user.id}`).joins[db.get(`users.${m.user.id}`).joins.length-1].by == member.user.id)
                .sort((a,b) => b.joinedTimestamp - a.joinedTimestamp)
                .slice(0, 10)
                .map(m => {
                    let u = db.get(`users.${m.user.id}`);
                    return `${m.user.toString()} - **${u.joins[u.joins.length-1].inviteCode}** - ${translate(`Önce **${fromIntToDate(Date.now() - u.joins[u.joins.length-1].at +7200000)}**`, `**${fromIntToDate(Date.now() - u.joins[u.joins.length-1].at +7200000, config.lang.toLowerCase())}** ago`)}`
                }).join("\n") || translate("❌ **Yok**", "❌ **Any**")
            ).setFooter(`${translate("Demandé par", "Asked by")}: ${author.tag}`, author.displayAvatarURL({ format: "png" }))

        let invitedHistoryButton = new MessageButton()
            .setCustomId(`invited-history_${member.user.id}_${author.id}`)
            .setStyle("SECONDARY")
            .setLabel(translate("Davet Edilen Üye Geçmişine Bakın", "View Invited Members History"))
    
        let invitesHistoryButton = new MessageButton()
            .setCustomId(`invites-list_${member.user.id}_${author.id}`)
            .setStyle("SECONDARY")
            .setLabel(translate("Davet Geçmişini Görüntüle", "View Active Invites History"))
    
        let bonusHistoryButton = new MessageButton()
            .setCustomId(`bonus-history_${member.user.id}_${author.id}`)
            .setStyle("SECONDARY")
            .setLabel(translate("Bonus Davet Geçmişini Görüntüle", "View Bonus Invites History"))
        
        let invitedHistoryActionRaw = new MessageActionRow()
            .addComponents([invitedHistoryButton, invitesHistoryButton, bonusHistoryButton])

        interaction.update({ embeds: [embed], components: [invitedHistoryActionRaw] });
    } else if(interaction.customId.startsWith("invites-list") && interaction.user.id == interaction.customId.split("_")[2]) {
        const author = interaction.user;
        const member = interaction.guild.members.cache.get(interaction.customId.split("_")[1]);
        if(!member) return interaction.update({ content: "Üye Sunucudan Ayrıldı", embeds: [], components: [] });

        let invitesArray = Array.from(await interaction.guild.invites.fetch())
            .map(i => i[1])
            .filter(i => i.inviter.id == member.user.id)
            .sort((a,b) => b.createdTimestamp - a.createdTimestamp)
            .map(i => {
                return `**${i.code}** - ${i.channel.toString()} - ${translate(`Önce**${fromIntToDate(Date.now() - i.createdTimestamp, "tr")}**`, `**${fromIntToDate(Date.now() - i.createdTimestamp, "en")}** Ago`)}`
            });
        let pages = [];
        let page = [];
        invitesArray.forEach(i => {
            page.push(i);
            if(page.length > 30) {
                pages.push(page);
                page = [];
            }
        });
        if(page.length > 0) {
            let pageEmbed = new MessageEmbed()
                .setColor(colors.blue)
                .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                .setFooter(`${translate("İsteyen", "Asked by")}: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
                .setDescription(
                    page.join("\n")
                )
            pages.push(pageEmbed);
        };
        if(pages.length == 0) {
            pages.push(
                new MessageEmbed()
                    .setColor(colors.red)
                    .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                    .setDescription(
                        `❌ - ${member.user.toString()} **${translate("Her Hangi Bir Davet Bulunmuyor", "Doesn't Have Any Invitation")}.**`
                    ).setFooter(author.tag, author.displayAvatarURL({ format: "png" }))
            )
        };
        
        let backButton = new MessageButton()
            .setCustomId(`info_${member.user.id}_${interaction.customId.split("_")[2]}`)
            .setStyle("SECONDARY")
            .setLabel(translate("Retour aux informations du membre", "Back To The Members Infos"))
        let backButtonActionRaw = new MessageActionRow()
            .addComponents([backButton])

        interaction.update({ embeds: pages, components: [backButtonActionRaw] })
    } else if(interaction.customId.startsWith("bonus-history") && interaction.user.id == interaction.customId.split("_")[2]) {
        const author = interaction.user;
        const member = interaction.guild.members.cache.get(interaction.customId.split("_")[1]);
        if(!member) return interaction.update({ content: "Le membre a quitté le serveur.", embeds: [], components: [] });

        let backButton = new MessageButton()
            .setCustomId(`info_${member.user.id}_${interaction.customId.split("_")[2]}`)
            .setStyle("SECONDARY")
            .setLabel(translate("Üye Bilgilerine Geri Dön", "Back To The Members Infos"))
        let backButtonActionRaw = new MessageActionRow()
            .addComponents([backButton])


        let pages = [];
        let page = [];
        if(!db.has(`users.${member.user.id}.bonusHistory`)) {
            db.set(`users.${member.user.id}.bonusHistory`, []);
        }; let user = db.get(`users.${member.user.id}`);
        if(!user.bonusHistory.length) {
            let emptyEmbed = new MessageEmbed()
                .setColor(colors.red)
                .setDescription(`❌ - ${member.user.id == author.id ? translate("**Sen**", "**You**") : member.user.toString()} ${translate("Hiç Bonus Davet Almadın", "Have Never Had Any Bonus Invitations")}`)
                .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                .setFooter(`${translate("İsteyen", "Asked by")}: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
            return interaction.update({ embeds: [emptyEmbed], components: [backButtonActionRaw] });
        };

        user.bonusHistory.reverse().forEach(bonus => {
            page.push(bonus);
            if(page.length >= 10) {
                pages.push(page);
                page = [];
            }
        }); if(page.length > 0) pages.push(page);

        pages = await Promise.all(pages.map(async (page) => {
            let p = await Promise.all(page.map(async (el) => {
                let user = client.users.cache.get(el.by) || await client.users.fetch(el.by);
                let emoji = el.action == "add" ? "📈" : "📉";
                let amount = "**" + el.amount.toLocaleString("fr") + "** " + (el.action == "add" ? translate("Ekleme", "Added") : translate("Çıkarma", "Subtracted"));
                let date = moment.utc(el.at).format("DD/MM/YYYY à HH:mm")
                let timestamp = fromIntToDate(Date.now() - el.at +7200000, config.lang.toLowerCase());
                let reason = el.reason ? `\n\`\`↪\`\` __**${translate("Raison", "Reason")} :**__ ${el.reason}` : "";

                return `${emoji} ${amount} ${translate("by", "by")} ${user.toString()}\n\`\`↪\`\` ${translate(` **${date}** (Önce **${timestamp}**)`, `On **${date}** (**${timestamp}** ago)`)}${reason}`
            }));
            return new MessageEmbed()
                .setColor(colors.blue)
                .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                .setFooter(`${translate("İsteyen", "Asked by")}: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
                .setDescription(
                    p.join("\n\n")
                )
        }));

        interaction.update({ embeds: pages, components: [backButtonActionRaw] });
    };
};