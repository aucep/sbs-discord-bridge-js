import axios from 'axios';
import Discord from 'discord.js';
import fs, { createWriteStream } from 'fs';

// a wrapper around the Discord.Client for routing messages to/from SBS
export default class DiscordClient extends Discord.Client {
    // [channel id -> webhook] cache map (is that the right term?)
    private webhooks: Map<string, Discord.Webhook> = new Map();

    userId: string = '';
    ownerId: string = '';

    constructor(public token: string) {
        super({ intents: ['GUILDS', 'GUILD_MESSAGES'] });
        // grab self and owner id on startup
        this.on('ready', async () => {
            console.log(`connected to Discord as ${this.user?.tag}!`);
            await this.user?.fetch();
            this.userId = this.user!.id;
            await this.application?.fetch();
            this.ownerId = this.application!.owner!.id;
        });
    }

    async start() {
        await this.login(this.token).then(console.log, console.error);
    }

    // 
    async send(channelId: string, msg: { name: string, content: string, avatarUrl: string }) {
        console.log(`TO DISCORD:${channelId}`, msg);
        const webhook = await this.getWebhook(channelId);
        if (!webhook) {
            console.error('could not send message: no webhook was available');
            return;
        }
        try {
            await webhook!.send({ username: msg.name, content: msg.content, avatarURL: msg.avatarUrl });
        } catch (e) {
            console.error('could not send message: webhook.send failed', e);
        }
    }

    // fetch cached webhook || find existing webhook || create new webhook
    async getWebhook(channelId: string): Promise<Discord.Webhook | null> {
        // fetch cached webhook
        if (this.webhooks.has(channelId)) return this.webhooks.get(channelId)!;

        // find existing webhook
        try {
            // fetch channel
            console.log('fetching channel...')
            const rawChannel = await this.channels.fetch(channelId as `${bigint}`);
            if (!rawChannel) {
                // check for null (error) before typecasting
                console.error('could not fetch channel!');
                return null;
            }
            const channel = rawChannel as Discord.TextChannel;

            // search for webhooks we own
            console.log('searching channel for webhooks...')
            try {
                const webhooks = await channel.fetchWebhooks();
                for (const webhook of webhooks.values()) {
                    if ((webhook.owner as Discord.User).id == this.userId) {
                        console.log('webhook found and cached.');
                        this.webhooks.set(channelId, webhook);
                        break;
                    }
                }
            } catch (e) {
                console.error('could not fetch webhooks!', e);
                // no `return null` here bc we might still be able to create a webhook
            }

            if (this.webhooks.has(channelId)) {
                // return existing webhook
                return this.webhooks.get(channelId)!;
            } else {
                // create new webhook
                console.log('creating new webhook')
                try {
                    const webhook = await channel.createWebhook('sbs bridge');
                    this.webhooks.set(channelId, webhook);
                    return webhook;
                } catch (e) {
                    console.error('could not create webhook!', e);
                    return null;
                }
            }
        } catch (e) {
            console.error('could not fetch channel!', e);
            return null;
        }
    }

    // download avatar
    async downloadAvatar(user: Discord.User, dest: string) {
        console.log(`Downloading avatar of ${user.tag} to ${dest}`);
        const avatarUrl =
            user.avatarURL({ format: 'png', size: 64 }) ?? 'https://cdn.discordapp.com/embed/avatars/2.png';
        const req = await axios.get(avatarUrl, { responseType: 'stream' });
        req.data.pipe(createWriteStream(dest));
    }
}