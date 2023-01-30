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

# add in my customizations (should be a volume?)
COPY ./overlay/_config.yml /hexo/keeb.dev/_config.yml
COPY ./overlay/themes/cactus/ /hexo/keeb.dev/themes/cactus


# the build step

FROM base-hexo-image as keeb-dev-generated

WORKDIR "/hexo/keeb.dev"
# Where the markdown/posts goes.
VOLUME "/hexo/keeb.dev/source/_posts"
RUN hexo generate

# The generated site output
VOLUME "/hexo/keeb.dev/public"

CMD ["hexo", "serve"]


