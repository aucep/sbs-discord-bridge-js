// roll your own bimap, every time, all the time
export default class LinkMap {
    discord2sbs: Map<string, number>;
    sbs2discord: Map<number, string>;

    constructor(sourceMap: Map<string, number>) {
        this.discord2sbs = sourceMap;
        const entries = Array.from(sourceMap.entries()).map(([c, r]) => [r, c]);
        this.sbs2discord = new Map(entries as [number, string][]);
    }

    getChannel(roomId: number) {
        return this.sbs2discord.get(roomId);
    }

    getRoom(channelId: string) {
        return this.discord2sbs.get(channelId);
    }

    hasChannel(roomId: number) {
        return this.sbs2discord.has(roomId);
    }

    hasRoom(channelId: string) {
        return this.discord2sbs.has(channelId);
    }

    set(channelId: string, roomId: number) {
        if (this.sbs2discord.has(roomId)) this.discord2sbs.delete(this.sbs2discord.get(roomId)!);
        if (this.discord2sbs.has(channelId)) this.sbs2discord.delete(this.discord2sbs.get(channelId)!);

        this.sbs2discord.set(roomId, channelId);
        this.discord2sbs.set(channelId, roomId);
    }

    delete(channelId: string) {
        const roomId = this.discord2sbs.get(channelId)!;
        this.sbs2discord.delete(roomId);
        this.discord2sbs.delete(channelId);
    }

    toArray(): [string, number][] {
        return Array.from(this.discord2sbs.entries());
    }
}