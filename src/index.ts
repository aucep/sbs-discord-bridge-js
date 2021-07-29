import { readConf } from './helper/files';
import Bridge from './bridge';

process.title = 'sbsdiscordbridge';

const bridge = new Bridge(
    readConf('config/auth'),
    readConf('save/linked'),
    readConf('save/avatars'),
);
bridge.start();
