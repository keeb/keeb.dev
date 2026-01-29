#!/usr/bin/sh

cd "$(dirname "$0")" || exit 1

unlink site-active 2>/dev/null
docker pull keeb/keeb.dev
docker run --name tmp-keeb-dev-deploy keeb/keeb.dev echo true
# || docker rm tmp-keeb-dev-deploy
docker cp tmp-keeb-dev-deploy:/app/public .
docker rm tmp-keeb-dev-deploy
mv public $(date +%F)
ln -s $(date +%F) site-active
docker-compose restart