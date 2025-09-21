FROM node:20-alpine
LABEL maintainer="keeb"

# Install system dependencies
RUN apk add --no-cache git

# Install hexo globally
RUN npm install -g hexo-cli

# Create working directory
WORKDIR /app

# Initialize hexo project
RUN hexo init . && npm install

# Install additional dependencies
RUN npm install hexo-asset-link chalk

# Clone and setup theme
RUN git clone https://github.com/probberechts/hexo-theme-cactus.git themes/cactus \
  && rm source/_posts/hello-world.md

# Copy configuration and theme customizations
COPY app/web/overlay/_config.yml ./_config.yml
COPY app/web/overlay/themes/cactus/ ./themes/cactus/

# Copy content
COPY app/web/overlay/writing/ ./source/_posts/

# Generate static files for production
RUN hexo generate

EXPOSE 4000

# Default to serving, but allow overriding for other commands
CMD ["hexo", "serve"]


