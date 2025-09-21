#!/usr/bin/sh

# Remove current active site link
[ -L site-active ] && unlink site-active

# Pull latest image and extract generated static files
docker pull keeb/keeb.dev
docker run --name tmp-keeb-dev-deploy keeb/keeb.dev echo "deployment ready"
docker cp tmp-keeb-dev-deploy:/app/public .
docker rm tmp-keeb-dev-deploy

# Create timestamped deployment
mv public $(date +%F)
ln -s $(date +%F) site-active

# Restart services if using docker-compose
if [ -f docker-compose.yml ]; then
    docker-compose restart
fi