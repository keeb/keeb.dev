#!/usr/bin/sh

docker run -v /home/keeb/code/projects/keeb.dev/overlay/writing:/hexo/keeb.dev/source/_posts \
    --user 1000:1000 \
    --rm keeb/keeb.dev \
    hexo new "${*}"
