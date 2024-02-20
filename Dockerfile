FROM alpine
LABEL maintainer="keeb"

# install npm
RUN apk add npm git nginx

# intall and initialize hexo
RUN npm install hexo-cli -g && mkdir /hexo
WORKDIR /hexo
RUN hexo init keeb.dev
WORKDIR /hexo/keeb.dev

# install hexo-asset-link
# thank you to (https://chrismroberts.com/2020/01/06/using-markdown-in-hexo-to-add-images/)
RUN npm i -s hexo-asset-link \
  && git clone https://probberechts.github.io/hexo-theme-cactus.git themes/cactus \
  && rm /hexo/keeb.dev/source/_posts/hello-world.md

# add in my customizations 
COPY ./overlay/_config.yml /hexo/keeb.dev/_config.yml
COPY ./overlay/themes/cactus/ /hexo/keeb.dev/themes/cactus


# time for content
COPY ./overlay/writing/ /hexo/keeb.dev/source/_posts

WORKDIR "/hexo/keeb.dev"

EXPOSE 4000
CMD ["hexo", "serve"]


