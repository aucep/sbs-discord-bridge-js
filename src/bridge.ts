import { writeConf } from './helper/files';
import Discord from 'discord.js';
import DiscordClient from './clients/discordSide';
import SBSClient, { SBSMessage } from './clients/sbsSide';
import LinkMap from './helper/bimap';
import { unlink } from 'fs/promises'
import Queue from './helper/queue';

type BridgeAuth = {
    discordToken: string,
    sbsToken: string,
    sbsUsername: string,
    sbsPassword: string,
    linkers: Array<string>,
}

const NONE_AVATAR_ID = 0

// sends 
export default class Bridge {
    // clients
    private discordSide: DiscordClient;
    private sbsSide: SBSClient

    // bimap! for easy (sbs room)<->(discord channel) lookup
    private linked: LinkMap;
    
    // queue! for making sure quick succession of discord messages won't
    //        result in multiple avatars being uploaded to sbs
    private avatarQueues: Map<string, Queue> = new Map();

    constructor(
        private auth: BridgeAuth,
        simpleLinked: Map<string, number>,
        private avatars: Map<string, number>,
    ) {
        // create clients (pass auth)
        this.discordSide = new DiscordClient(auth.discordToken);
        this.sbsSide = new SBSClient(
            auth.sbsToken, auth.sbsUsername, auth.sbsPassword,
            (token: string) => {
                this.auth.sbsToken = token;
                writeConf('config/auth', this.auth);
            });

        // set up initial bridged channels
        this.linked = new LinkMap(simpleLinked);
        for (const [discordChannel, sbsRoom] of this.linked.toArray())
            this.link(discordChannel, sbsRoom, false);
        

        // handle message events
        // (discord -> sbs) 
        this.discordSide.on('messageCreate', async ({channel: {id: channelId}, member, content, author}) => {
            if (author.bot || !this.linked.hasRoom(channelId)) return;
            // todo: support bot/webhook messages
            await member?.fetch();
            // forward message to sbs room
            this.sbsSide.send(this.linked.getRoom(channelId)!,
                {
                    name: member?.id == this.discordSide.userId
                        ? ''
                        : member?.nickname ?? member?.displayName ?? 'name not found',
                    content: content,
                    avatarId: await this.fetchAvatarId(author),
                }
            );
        });
        // (sbs -> discord)
        this.sbsSide.onMessage = ({roomId, content, name, avatarId}) => {
            if (!this.linked.hasChannel(roomId!)) return;
            this.discordSide.send(this.linked.getChannel(roomId!)!,
                {
                    name: name!,
                    content: content,
                    avatarUrl: `https://smilebasicsource.com/api/File/raw/${avatarId}`,
                }
            );
        };

        // (handle commands)
        this.discordSide.on('interactionCreate', async (int: Discord.Interaction) => {
            // skip non-command interactions
            if (!int.isCommand()) return;

            // skip if in DMs
            if (!int.inGuild()) {
                await int.reply({ content: "You're not in a guild!" });
                return;
            }

            // you must be bot owner or in auth.linked to use commands
            console.log(int.user.id, this.discordSide.ownerId);
            const authorized = int.user.id == this.discordSide.ownerId || auth.linkers.includes(int.user.id);
            if (!authorized) {
                await int.reply({ content: "You're not authorized to do that!" });
                return;
            }

            // command switch!
            try {
                switch (int.commandName) {
                    // link a discord channel and an sbs room together
                    case 'link':
                        {
                            const roomId = int.options.get('room_id')!.value;
                            this.link(int.channelId, roomId as number);
                            this.updateLinked();
                            const name = (int.channel as Discord.TextChannel).name;
                            await int.reply({ content: `Linked "${name}" to sbs:page/${roomId}` });
                        }
                        break;

                    // unlink a discord channel from its sbs room if possible
                    case 'unlink':
                        {
                            const roomId = this.unlink(int.channelId);
                            this.updateLinked();
                            await int.reply(
                                {
                                    content: roomId !== null
                                        ? `Unlinked this channel from sbs:page/${roomId}`
                                        : "This channel isn't linked!"
                                });
                        }
                        break;

                    // unsupported command
                    default:
                        await int.reply(
                            { content: 'Sorry, the only commands I can handle are `/link` and `/unlink`!' });
                }
            } catch (e) {
                console.error('could not handle command', e);
            }
        });
    }

    // start the bridge
    async start() {
        // start clients
        this.discordSide.start();
        this.sbsSide.start();
    }

    // == functions for updating config files ==
    
    // save discord -> sbs avatar mapping
    updateAvatarMapping(path: string, id: number) {
        this.avatars.set(path, id);
        writeConf('save/avatars', Array.from(this.avatars.entries()));
    }

    // save discord channel <-> sbs room mapping
    updateLinked() {
        writeConf('save/linked', this.linked.toArray());
    }

    // returns avatar id from cache or handles uploading
    async fetchAvatarId(user: Discord.User, tried = false): Promise<number> {
        const avatar = user.avatar ? `${user.id}/${user.avatar}` : 'default';

        // quick queue bypass if possible?
        if (this.avatars.has(avatar)) return this.avatars.get(avatar)!;

        // pop into queue per avatar so we dont get repeat uploads
        if (!this.avatarQueues.has(avatar)) this.avatarQueues.set(avatar, new Queue());
        return this.avatarQueues.get(avatar)!.do(async () => {
            // cached?
            if (this.avatars.has(avatar)) return this.avatars.get(avatar)!;

            // oh well,
            try {
                // download avatar from discord
                const filepath = `avatars/${avatar.replace('/', '_')}.png`;
                await this.discordSide.downloadAvatar(user, filepath);

                // upload avatar to sbs
                const {data: {id: avatarId}} = await this.sbsSide.uploadFile(filepath);
                this.updateAvatarMapping(avatar, avatarId);

                // delete avatar file
                unlink(filepath);

                // yay!
                return avatarId;
            } catch (e) {
                console.error('could not copy avatar!', e);
                // try twice just in case
                if (e.response.status == 401 && !tried) return this.fetchAvatarId(user, true);
                return NONE_AVATAR_ID;
            }
        });
    }

    // link a discord channel to an sbs room
    link(channelId: string, roomId: number, update = true) {
        console.log(`bind discord:${channelId} to sbs:${roomId}`);
        if (update) this.linked.set(channelId, roomId);
    }

    unlink(channelId: string): number | null {
        if (!this.linked.hasRoom(channelId)) return null;
        const roomId = this.linked.getRoom(channelId)!;
        this.linked.delete(channelId);
        return roomId;
    }
}