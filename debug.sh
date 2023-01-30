#!/usr/bin/env sh

docker build -t keeb/keeb.dev .

docker run \
    -v $(pwd)/overlay/writing:/hexo/keeb.dev/source/_posts \
    --rm -it -p 4000:4000 \
     keeb/keeb.dev /bin/sh 