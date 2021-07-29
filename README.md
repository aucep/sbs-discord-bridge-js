# sbs-discord-bridge-js
replacement/rewrite of [discord-sbs-bridge](https://github.com/ilovecherries/discord-sbs-bridge) by Cherry for the purpose of easy(tm) markdown conversion

# running
ensure your Discord bot has command and webhook management permissions in your server

create blank config files with `sh init-config.sh`

fill out `config/auth.json`

`npm install`

register commands with `npm run register`

start the bridge with `npm start`

from Discord, use `/link <room>` and `/unlink`

# todo (in no particular order)
- [#] save config/cache on change
- [#] discord command handling 
- [#] sbs long polling
- [#] sbs avatar uploading
- [#] message sending
    - [#] sbs -> discord
    - [#] discord -> sbs
- [ ] markdown conversion
    - [ ] sbs -> discord
    - [ ] discord -> sbs
- [ ] bot message support
- [ ] mirror message updates
    - [ ] deletion
        - [ ] ->discord
        - [ ] ->sbs
    - [ ] edits
        - [ ] ->sbs
        - [ ] ->discord (possible?)
