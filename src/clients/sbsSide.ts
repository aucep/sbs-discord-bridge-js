import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { createReadStream } from 'fs';
import FormData from 'form-data';

export interface SBSMessage {
    name: string,
    content: string,
    avatarId: number,
    roomId?: number,
}

// SBS client that does long-polling, message send, and avatar uploading
export default class SBSClient {
    private api: APIClient;
    private selfUserId: number = 0;
    onMessage: (msg: SBSMessage) => void = () => { };

    constructor(token: string, username: string, password: string, saveToken: (token: string) => void) {
        this.api = new APIClient(token, username, password, saveToken);
    }

    async start() {
        this.selfUserId = await this.getSelfUserId();
        await this.longpoll();
    }

    async longpoll() {
        let lastCommentId = await this.getLastCommentId();
        while (true) {
            try {
                const actions = { "lastId": lastCommentId, "chains": ["comment.0id", "user.1createUserId"] }
                // the actual 
                let { data } = await this.api.get(`Read/listen?actions=${encodeParam(actions)}`);
                console.log(data);
                lastCommentId = data.lastId;
                let users = data.chains.user as Array<any>;
                let messages: Array<any> = data.chains.comment;
                messages = messages.filter(({createUserId}) => createUserId != this.selfUserId).map(({createUserId, parentId, content}): SBSMessage => {
                    let options: any = {};
                    try {
                        let parts = (content as string).split('\n',2);
                        if (parts.length > 1) {
                            options = JSON.parse(parts[0]);
                            content = parts[1];
                        }
                    } finally {}
                    let user = users.find(({id}) => id == createUserId)
                    return {
                        name: options.b ?? options.n ?? user?.username ?? 'name not found',
                        content,
                        avatarId: user?.avatar ?? 0,
                        roomId: parentId,
                    };
                });
                messages.forEach(this.onMessage);
            } catch (e) {
                if (e.code == 'ECONNABORTED') {
                    console.error('timed out!');
                } else {
                    console.error(e);
                }
            }
        }
    }

    async send(roomId: number, msg: SBSMessage) {
        try {
            console.log(`TO SBS:${roomId}`, msg);
            let options: any = {
                a: msg.avatarId,
                m: '12y',
            };
            if (msg.name) options.b = msg.name;

            const data = {
                parentId: roomId,
                content: JSON.stringify(options) + '\n' + msg.content
            }
            await this.api.post('Comment', data);
        } catch (e) {
            console.error('could not send message!', e)
        }
    }

    async getSelfUserId(): Promise<number> {
        const { data: { id } } = await this.api.get('User/me');
        return id;
    }

    async getLastCommentId(): Promise<number> {
        const constraint = { Reverse: true, Limit: 1 };
        const { data: { comment: [{ id }] } } =
            await this.api.get(`Read/chain?requests=comment-${encodeParam(constraint)}&comment=id`);
        return id;
    }

    // https://stackoverflow.com/a/55745576
    async uploadFile(filepath: string): Promise<any> {
        const data = new FormData();

        data.append('file', createReadStream(filepath));

        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...data.getHeaders(),
            },
            params: {
                bucket: 'discordavatars',
            }
        };

        return await this.api.post('File', data, config);
    }


}

// This client wraps the axios client to retry on rate limits and auth failure.
class APIClient {
    private inner = axios.create({ baseURL: 'https://newdev.smilebasicsource.com/api/' });

    constructor(
        private token: string,
        private username: string,
        private password: string,
        private saveToken: (token: string) => void
    ) {
        this.inner.interceptors.request.use((config) => {
            if (this.token) {
                config.headers ??= {};
                config.headers['Authorization'] = `Bearer ${this.token}`;
            }
            return config;
        });
    }

    async get(endpoint: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        config ??= {};
        return await this.request('GET', endpoint, config, false);
    }
    async post(endpoint: string, data: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        config ??= {};
        return await this.request('POST', endpoint, config, false, data);
    }

    private async request(method: 'GET' | 'POST', endpoint: string, config?: AxiosRequestConfig, tried?: boolean, data?: any): Promise<AxiosResponse> {
        try {
            console.log(`SBS: making ${method} request to ${endpoint}`, config);
            if (method == 'GET') {
                return await this.inner.get(endpoint, config);
            } else if (method == 'POST') {
                return await this.inner.post(endpoint, data, config);
            } else {
                // invalid method, you don't deserve to keep the bridge running
                process.exit(1);
            }
        } catch (e) {
            if (!e.isAxiosError) throw e; // no idea what this is from, need to fix
            if (e.code == 'ECONNABORTED') throw e; // throw timeout further up
            if (!tried && e.response) {
                const status = e.response.status;
                if (status == 401) {
                    // invalid auth
                    // refresh auth and try again
                    console.error('auth was invalid! attempting to refresh...');
                    await this.refreshAuth();
                    return await this.request(method, endpoint, config, true, data);
                } else if (status == 429) {
                    // rate limited
                    // wait 3s and try again
                    console.error('rate limited! waiting some time before retrying...')
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    return await this.request(method, endpoint, config, true, data);
                }
            }
            throw e;
        }
    }

    // re-authenticate for a new token
    async refreshAuth() {
        try {
            const { status, statusText, data } = await this.post('User/authenticate', {
                expireSeconds: 0,
                username: this.username,
                password: this.password,
            });

            if (status == 200) {
                console.log('refreshed auth', status, statusText, data);
                this.token = data;
                this.saveToken(data);
            } else {
                // i have no idea what would have happened here
                // and so i don't know whether/how the bridge could recover
                console.error('could not refresh auth?? hey could you look into this please?',
                    status, statusText);
                process.exit(1);
            }
        } catch (e) {
            if (e.isAxiosError) {
                console.error('could not refresh auth!', e.response.data.status, e.response.data.title);
                if (e.response.data.status == 400) {
                    // the auth info is incorrect, so there's no point in keeping the bridge running
                    // we can't get a token, so we can't longpoll and just send to discord
                    process.exit(126);
                    // if this is valid usage of the ENOKEY exit code, i will lay your eggs
                }
            } else {
                console.error('could not refresh auth!', e);
            }
        }
    }
}

function encodeParam(data: any): string {
    return encodeURIComponent(JSON.stringify(data));
}