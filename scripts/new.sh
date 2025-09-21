#!/usr/bin/sh

docker run -v "$(pwd)/app/web/overlay/writing:/app/source/_posts" \
    --user $(id -u):$(id -g) \
    --rm keeb/keeb.dev \
    hexo new "${*}"
