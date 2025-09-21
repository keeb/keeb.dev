# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hexo-based static site generator for https://keeb.dev. The project uses Docker for containerization and deployment, with a custom Nginx configuration for serving multiple subdomains.

## Architecture

- **Blog Engine**: Hexo static site generator with custom Cactus theme
- **Content**: Markdown posts stored in `app/web/overlay/writing/`
- **Deployment**: Docker-based with automated deployment scripts
- **Web Server**: Nginx with configurations for multiple subdomains (keeb.dev, counter.keeb.dev, flix.keeb.dev, etc.)
- **Static Assets**: Additional files in `app/static/`

## Development Commands

### Building the Image
```bash
docker build -t keeb/keeb.dev .
```

### Creating a New Post
```bash
./scripts/new.sh "POST NAME FOREVER"
```

### Local Preview
```bash
docker-compose --profile serve up
```
This serves the site locally on port 4000.

### Deployment
```bash
./scripts/deploy.sh
```
This script pulls the latest image, generates static files, and creates a timestamped deployment with symbolic link.

## Key Directories

- `app/web/overlay/writing/` - Blog posts and associated assets
- `app/web/overlay/themes/cactus/` - Custom theme files
- `app/web/config/nginx.conf` - Main Nginx configuration
- `app/web/config/sites/` - Individual site configurations
- `app/static/` - Static assets served directly
- `scripts/` - Deployment and utility scripts

## Hexo Configuration

The main Hexo config is at `app/web/overlay/_config.yml`. The project uses:
- hexo-asset-link plugin for image handling
- Custom Cactus theme with modifications
- Asset folders enabled for post-specific images

## Docker Architecture

- Multi-stage Dockerfile with Alpine base
- Development stage for creating new posts
- Production stage for serving content
- Volume mounting for live content editing during development