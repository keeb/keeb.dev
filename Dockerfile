FROM alpine as base-hexo-image
LABEL maintainer="keeb"

# install npm
RUN apk add npm git



# intall and initialize hexo
RUN npm install hexo-cli -g
RUN mkdir /hexo
WORKDIR /hexo
RUN hexo init keeb.dev
WORKDIR /hexo/keeb.dev


# install hexo-asset-link
# thank you to (https://chrismroberts.com/2020/01/06/using-markdown-in-hexo-to-add-images/)
RUN npm i -s hexo-asset-link

# install cactus theme
RUN git clone https://github.com/probberechts/hexo-theme-cactus.git themes/cactus



# add in my customizations 
COPY ./overlay/_config.yml /hexo/keeb.dev/_config.yml
COPY ./overlay/themes/cactus/ /hexo/keeb.dev/themes/cactus

# remove the default hello world post
RUN rm /hexo/keeb.dev/source/_posts/hello-world.md


# time for content
COPY ./overlay/writing/ /hexo/keeb.dev/source/_posts

WORKDIR "/hexo/keeb.dev"

FROM base-hexo-image as generate
RUN hexo generate

FROM generate as deploy
RUN apk add minio-client
# move to env vars
RUN mcli alias set site http://10.0.0.59:9000 7plruDkcaX0pmOn51wgC 7AxbkPnuhXed7DUFPk6Hwwo4vgfqIjvz4o9Cir6T
RUN mcli rm --bypass site/keeb.dev/public
RUN mcli cp -r public site/keeb.dev/


FROM base-hexo-image as serve
EXPOSE 4000
CMD ["hexo", "serve"]


