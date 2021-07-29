import { readConf } from '../helper/files';
import Discord from 'discord.js';

let client = new Discord.Client({ intents: [] });

client.on('ready', async () => {
    console.log(`Logged in as ${client?.user?.tag}!`);

    //remove global commands
    console.log('removing all global commands');

    await client.application?.fetch();
    await client.application?.commands.fetch();

    let commands = client.application?.commands.cache.values()!;
    for (let c of commands) {
        try {
            await c.delete();
            console.log(`\tcommand ${c.name} removed!`)
        } catch (e) {
            console.error(e)
        }
    }

    //remove guild commands
    console.log('removing all guild commands');
    let guilds = client.guilds.cache.values();
    for (let g of guilds) {
        await g.fetch();
        await g.commands.fetch();

        console.log(`guild ${g.name}`)

        let commands = g.commands.cache.values();
        let wasEmpty = true;
        for (let c of commands) {
            wasEmpty = false;
            try {
                await c.delete();
                console.log(`\t/${c.name} command removed!`)
            } catch (e) {
                console.error(e)
            }
        }
        if (wasEmpty) console.log('\t(empty)')
    }

    console.log('finished. -v-')
    process.exit();
});

let auth = readConf('config/auth');

client.login(auth.discordToken);