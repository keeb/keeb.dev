#!/bin/sh
cd "$(dirname "$0")" || exit 1

docker pull keeb/keeb.dev
docker run --name tmp-keeb-dev-deploy keeb/keeb.dev echo true
docker cp tmp-keeb-dev-deploy:/app/public .
docker rm tmp-keeb-dev-deploy
ts="$(date +%F-%H%M%S)"
mv public "$ts"
unlink site-active 2>/dev/null
ln -snf "$ts" site-active
docker compose restart caddy
