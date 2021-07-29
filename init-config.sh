#!/bin/sh
mkdir -p config save avatars

cat > config/auth.json << EOM
{
	"discordToken": "necessary",
	"sbsToken": "not necessary",
	"sbsUsername": "necessary",
	"sbsPassword": "necessary",
	"linkers": ["ids of users who can /link (bot owner is always able)"]
}
EOM

echo '[]' | tee save/linked.json > save/avatars.json 