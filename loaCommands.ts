import Discord, { AnyChannel, ButtonInteraction, CacheType, Collection, Guild, Intents, Interaction, Message, MessageActionRow, MessageButton, MessageCollector, MessageEmbed, TextChannel, User } from 'discord.js'
const fs = require ('fs')

const guildId = '743106884890001408'
const loaChannelId = '941499381415292948'
const loaReqChannelId = '941499381415292948'
const loaFile = './loas.json'

let guild: Discord.Guild
let client: Discord.Client

let activeLoas = new Map<string, (Date|string)[]>()

export function onReady(mainClient: Discord.Client) {
  client = mainClient
  guild = client.guilds.cache.get(guildId)!

  if (!guild) {
    client.guilds.fetch(guildId).then(promiseGuild => guild = promiseGuild)
  }

  let loaReqChannel: TextChannel = (<TextChannel> guild?.channels.cache.get(loaReqChannelId))
  const loaChannel: TextChannel = (<TextChannel> guild?.channels.cache.get(loaChannelId))

  loadLOAs()

  var checkLoop = setInterval(checkLOAs, 60000)
}

async function loadLOAs () {
  console.log("Loading LOAs")
  const json = require(loaFile)
  for (var key in json) {
    let loaMessage = (<TextChannel> client.channels.cache.get(loaChannelId)).messages.cache.get(key)
    if (loaMessage) {
      activeLoas.set(key, json[key])
      loaMessage.awaitMessageComponent({componentType: 'BUTTON'}).then(async cnclInt => {
        if (cnclInt.customId === 'loa_cancel') {
          cancelLoaMsg(loaMessage!)
        }
      })
    } else {
      await client.channels.fetch(loaChannelId).then(channel => {
        (<TextChannel> channel).messages.fetch(key).then(message => {
          if (message) {
            activeLoas.set(key, json[key])
            message.awaitMessageComponent({componentType: 'BUTTON'}).then(async cnclInt => {
              if (cnclInt.customId === 'loa_cancel') {
                cancelLoaMsg(loaMessage!)
              }
            })
          }
        }).catch(err => {
          console.log(`Error on Loading Messages: ${err}`)

        })
      })
    }
  }
  saveLOAs()
}

async function saveLOAs() {
  console.log("Saving LOAs")
  let json: any = {}
  activeLoas.forEach((dateUser, msgId) => {
    json[msgId] = dateUser
  })
  let data = JSON.stringify(json, null, 2)
  const fs = require ('fs')
  fs.writeFile(loaFile, data, function(err: any) {
    if (err) {
      console.log(`Can't write to file: ${err}`)
    } else {
      console.log("Saved LOAs")
    }
  })
}

async function checkLOAs () {
  const now = new Date()
  console.log("Checking LOAs")
  activeLoas.forEach((dateUsr, msgId) => {
    if (dateUsr[0] <= now) {
      cancelLoaId(msgId)
    }
  })
  saveLOAs()
}

export async function createLoa(interaction: Discord.CommandInteraction, options: Omit<Discord.CommandInteractionOptionResolver<Discord.CacheType>, "getMessage" | "getFocused">) {
  let desc = options.getString('desc')!
  let length = options.getString('length')!

  if (length.length > 1) {
    length.replace('D', 'd')
    length.replace('W', 'w')
    length.replace('M', 'm')
    length.replace('Y', 'y')
    let dayIndex = length.indexOf('d')
    let weekIndex = length.indexOf('w')
    let monthIndex = length.indexOf('m')
    let yearIndex = length.indexOf('y')
    let splitString = length.split('d').join(',').split('w').join(',').split('m').join(',').split('y').join(',').split(',')
    let indexArray: number[] = []

      if (dayIndex != -1) {
        indexArray.push(dayIndex)
      }
      if (weekIndex != -1) {
        indexArray.push(weekIndex)
      }
      if (monthIndex != -1) {
        indexArray.push(monthIndex)
      }
      if (yearIndex != -1) {
        indexArray.push(yearIndex)
      }
    let temp = ``

    indexArray = indexArray.sort((n1,n2) => n1 - n2)

    let date: Date = new Date()

    for (let i = 0; i <= indexArray.length; i++) {
      let num = splitString[i]
      switch (true) {
        case indexArray[i] == yearIndex:
          temp += `${num} Year(s)  `
          date.setFullYear(date.getFullYear() + +num)
          break
          case indexArray[i] == monthIndex:
            temp += `${num} Month(s)  `
            date.setMonth(date.getMonth() + +num)
            break
        case indexArray[i] == weekIndex:
          temp += `${num} Week(s)  `
          date.setDate(date.getDate() + (+num * 7))
          break
        case indexArray[i] == dayIndex:
          temp += `${num} Day(s)  `
          date.setDate(date.getDate() + +num)
          break
      }
    }

    

    if (temp != ``) {
      length = temp
    }

    const embed = new MessageEmbed()
      .setDescription("=====================")
      .setColor('GREEN')
      .setAuthor({name: `LOA to send from: ${interaction.guild?.members.cache.get(interaction!.member!.user.id)?.displayName}`})
      .addFields([{name: 'Reason',value: `${desc}`},{name: 'Length',value: `${length}Ends on ${date.toDateString()}`}])
    const row = new MessageActionRow()
      .addComponents(new MessageButton().setCustomId('loa_yes').setEmoji('✅').setLabel('Confirm').setStyle('SUCCESS'))
      .addComponents(new MessageButton().setCustomId('loa_no').setEmoji('❌').setLabel('Cancel').setStyle('DANGER'))

    await interaction.editReply({embeds: [embed], components: [row]})
    const collector = interaction.channel?.createMessageComponentCollector({
      max: 1
    })
    collector?.on('collect', async (collection) => {
      if (collection.customId === 'loa_yes') {
        const staffEmbed = new MessageEmbed()
          .setDescription("=====================")
          .setColor('GREEN')
          .setAuthor({name: `LOA from: ${interaction.guild?.members.cache.get(interaction!.member!.user.id)?.displayName}`})
          .addFields([
            {
              name: 'Reason',
              value: `${desc}`
            },
            {
              name: 'Length',
              value: `${length}`
            }
          ])
          .setFooter({text: `${date.toDateString()}`})

        sendStaffLoa(staffEmbed, collection.user.id)

        interaction.editReply({embeds: [(await interaction.fetchReply()).embeds[0]],components: []})

        console.log(`Registered an LOA for ${interaction.guild?.members.cache.get(interaction!.member!.user.id)?.displayName}`)
      } else {
        await interaction.editReply({
          embeds: [(<MessageEmbed> (await interaction.fetchReply()).embeds[0]).setColor('RED')],
          components: []
        })
        console.log(`Cancelled an LOA for ${interaction.guild?.members.cache.get(interaction!.member!.user.id)?.displayName}`)
      }
    })
  }
}

export async function sendStaffLoa (staffEmbed: MessageEmbed, userId: string) {
  const loaReqChannel: TextChannel = (<TextChannel> guild.channels.cache.get(loaReqChannelId))
  const loaChannel: TextChannel = (<TextChannel> guild.channels.cache.get(loaChannelId))

  const row = new MessageActionRow()
    .addComponents(new MessageButton().setCustomId('loa_accept').setEmoji('✅').setLabel('Accept').setStyle('SUCCESS'))
    .addComponents(new MessageButton().setCustomId('loa_decline').setEmoji('❌').setLabel('Decline').setStyle('DANGER'))

  let message = await loaReqChannel.send({
    embeds: [staffEmbed],
    components: [row]
  })

  const filter = (i:any) => {
    i.deferUpdate();
    return i.customId === 'loa_accept';
  };

  message.awaitMessageComponent({componentType: 'BUTTON'}).then(async btnInt => {
    await btnInt.update({
      components: []
    })
    if (btnInt.customId === 'loa_accept') {
      const loaEmbed = staffEmbed

      const cancelRow = new MessageActionRow()
        .addComponents(new MessageButton().setCustomId('loa_cancel').setEmoji('❌').setLabel('Cancel').setStyle('DANGER'))

      loaEmbed.setDescription(`Accepted by ${btnInt.guild!.members.cache.get(btnInt!.member!.user.id)?.displayName}`)
      let userName = guild.members.cache.get(userId)?.displayName
      if (userName) {
        guild.members.cache.get(userId)?.setNickname(`${userName} [LOA]`)
      } else {
        await guild.members.fetch(userId).then(member => {
          member.setNickname(`${member.displayName} [LOA]`)
        })
      }
      await loaChannel.send({
        embeds: [loaEmbed],
        components: [cancelRow]
      }).then(async loaMessage => {
        activeLoas.set(loaMessage.id, [userId, new Date(loaEmbed.footer?.text!)])
        loaMessage.awaitMessageComponent({componentType: 'BUTTON'}).then(async cnclInt => {
          if (cnclInt.customId === 'loa_cancel') {
            cancelLoaMsg(loaMessage)
          }
        })
      })
    }
    await message.delete()
  })
}

async function cancelLoaMsg(msg: Message) {

  if (!msg) return false

  let usrId: any = (activeLoas.get(msg.id)!)[0]
  let userName = guild.members.cache.get(usrId)?.displayName
  if (userName) {
    guild.members.cache.get(usrId)?.setNickname(`${userName.replace(" [LOA]", "")}`).catch(err => console.log(`Can't Change name of: ${userName}`))
  } else {
    await guild.members.fetch(usrId).then(member => {
      member.setNickname(`${member.displayName.replace(" [LOA]", "")}`).catch(err => console.log(`Can't Change name of: ${member.displayName}`))
    })
  }

  activeLoas.delete(msg.id)
  console.log(`Cancelled LOA with ID: ${msg.id}`)
  await msg.delete()
  return true
}

async function cancelLoaId(msgId: string) {
  let msg = (<TextChannel> client.channels.cache.get(loaChannelId)).messages.cache.get(msgId)!

  if (!msg) return false

  let usrId: any = (activeLoas.get(msg.id)!)[0]
  let userName = guild.members.cache.get(usrId)?.displayName
  if (userName) {
    guild.members.cache.get(usrId)?.setNickname(`${userName.replace(" [LOA]", "")}`).catch(err => console.log(`Can't Change name of: ${userName}`))
  } else {
    await guild.members.fetch(usrId).then(member => {
      member.setNickname(`${member.displayName.replace(" [LOA]", "")}`).catch(err => console.log(`Can't Change name of: ${member.displayName}`))
    })
  }

  activeLoas.delete(msg.id)
  console.log(`Cancelled LOA with ID: ${msgId}`)
  await msg.delete()
  return true
}