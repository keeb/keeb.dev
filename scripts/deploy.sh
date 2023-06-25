#!/usr/bin/sh

docker pull keeb/keeb.dev
docker run --name tmp-keeb-dev-deploy keeb/keeb.dev echo true 
# || docker rm tmp-keeb-dev-deploy
docker cp tmp-keeb-dev-deploy:/hexo/keeb.dev/public .
docker rm tmp-keeb-dev-deploy
mv public $(date +%F)
ln -s $(date +%F) site-current 