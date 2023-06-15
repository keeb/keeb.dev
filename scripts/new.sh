#!/usr/bin/sh

docker run -v /home/keeb/code/projects/keeb.dev/overlay/writing:/hexo/keeb.dev/source/_posts \
    --rm keeb/hexo-new-base \
    hexo new "${*}"
