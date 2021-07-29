import { readConf } from '../helper/files';
import Discord from 'discord.js';

let client = new Discord.Client({ intents: [] });

let link = {
    "name": "link",
    "description": "links this channel to an sbs room",
    "options": [
        {
            "type": 4,
            "name": "room_id",
            "description": "the id of the room this channel should link to",
            "required": true
        }
    ]
};
let unlink = {
    "name": "unlink",
    "description": "unlinks this channel if possible",
};

client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);

    //add a /link guild command to every guild the bot is in,
    //because waiting for global commands to propagate is annoying
    let guilds = client.guilds.cache.values();
    for (let g of guilds) {
        await g.fetch();
        console.log(`guild ${g.name}`)
        try {
            await g.commands.create(link);
            console.log(`\t/link command added`);
            await g.commands.create(unlink);
            console.log(`\t/unlink command added`)
        } catch (e) {
            console.error(e);
        }
        
    }

    console.log('Finished.');
    process.exit();
});

let auth = readConf('auth');

client.login(auth.discordToken);