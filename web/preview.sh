#!/usr/bin/env sh

docker build -t keeb/keeb.dev:preview .

docker run --rm --volumes-from keeb.dev \
    -p 4000:4000 \
    keeb/keeb.dev:preview
