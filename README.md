# sbs-discord-bridge-js
replacement/rewrite of [discord-sbs-bridge](https://github.com/ilovecherries/discord-sbs-bridge) by Cherry for the purpose of easy(tm) markdown conversion

# running
ensure your Discord bot has:
- scopes:  `bot`, `applications.commands`
- bot perms: `Manage Webhooks`

create blank config files with `sh init-config.sh`

fill out `config/auth.json`

install dependencies with `npm install`

register commands with `npm run register`

start the bridge with `npm start`

from Discord, use `/link <room>` (and maybe `/unlink`)

# todo (in no particular order)
- [x] save config/cache on change
- [x] discord command handling 
- [x] sbs long polling
- [x] sbs avatar uploading
- [x] message sending
    - [x] sbs -> discord
    - [x] discord -> sbs
- [ ] markdown conversion
    - [ ] sbs -> discord
    - [ ] discord -> sbs
        - [ ] embed patch
- [ ] bot message support
- [ ] mirror message updates
    - [ ] deletion
        - [ ] ->discord
        - [ ] ->sbs
    - [ ] edits
        - [ ] ->sbs
        - [ ] ->discord (most recent message only?)
