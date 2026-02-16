# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hexo-based static site generator for https://keeb.dev. The site is served by Caddy on a DigitalOcean droplet, with structured JSON access logs shipped to Loki via Docker's Loki logging driver.

## Architecture

- **Blog Engine**: Hexo static site generator with custom Cactus theme
- **Content**: Markdown posts stored in `app/web/overlay/writing/`
- **Web Server**: Caddy 2 (Alpine) with automatic HTTPS
- **Deployment**: Docker-based with timestamped releases and symlink switching
- **Static Assets**: Additional files in `app/static/`

## Server Layout

The production server is at `ssh keeb@keeb.dev`:

```
/home/keeb/keeb.dev/          # deployed configs + site releases
├── Caddyfile                 # Caddy config (from conf/Caddyfile)
├── docker-compose.yml        # compose file (from conf/docker-compose-caddy.yml)
├── deploy.sh                 # deploy script (from scripts/deploy.sh)
├── site-active -> 2026-xx-xx # symlink to current release
└── 2026-02-14-051403/        # timestamped release directory

/home/keeb/promtail/config.yml  # Promtail config (from conf/promtail.yml)
/home/keeb/static/              # static assets served at /static/
/home/keeb/slate/               # served at /slate/
/home/keeb/bio/                 # served at /bio/
/home/keeb/start/               # served at /start/ (unused in Caddy currently)
```

## Observability

- **Docker logging driver**: Set to `loki` globally on the host — all container stdout/stderr ships directly to Loki (no Promtail needed for container logs)
- **Caddy access logs**: Global JSON structured logging enabled, each site has `log` directive. Logs include request method, URI, status, duration, size, remote IP, TLS info, user agent
- **Promtail**: Runs as a standalone container, scrapes system logs only (syslog, auth.log, /var/log/*.log) and ships to Loki
- **Loki**: Runs on homelab (100.92.243.19:3100 via Tailscale)
- **Grafana**: Runs on homelab at `grafana.treehouse.local`, dashboard UID `caddy-access-logs`
- **Homelab repo**: `keeb@10.0.0.12:~/code/projects/homelab-hancock`

### Automated Abuser Detection

An automated workflow on slate (10.0.0.33) detects and blocks abusive IPs every 15 minutes:

- **Workflow**: `block-abusers` — runs via cron in the `discord-bot` Docker container on slate
- **Swamp models**: `@user/http/fetch` (generic HTTP client) and `@user/caddy/firewall` (analyze + apply)
- **Model files**: `/opt/proxmox-manager/extensions/models/http_fetch.ts` and `caddy_firewall.ts`
- **Detection signals**: High request rate (>100/15min), scanner probes (>3 vuln paths/15min), 4xx error floods (>50/15min)
- **Blocklist**: Managed in the `(blocked_ips)` Caddy snippet — `@blocked remote_ip <IPs>` with `abort`
- **Safeguards**: Never blocks private IPs, additive-only (never removes existing blocks), all data stored as swamp resources
- **SSH access**: slate's root key is authorized on `keeb@keeb.dev` for Caddyfile updates + Caddy reloads

### Useful LogQL queries

```
# All access logs
{container_name="keeb-caddy"} | json | logger=`http.log.access`

# Errors only
{container_name="keeb-caddy"} | json | logger=`http.log.access` | status >= 400

# By host
{container_name="keeb-caddy"} | json | logger=`http.log.access` | request_host=`keeb.dev`
```

## Sites Served

- **keeb.dev** — main blog (Hexo static site)
- **keeb.dev/static/** — static assets
- **keeb.dev/slate/** — slate project
- **keeb.dev/bio/** — bio page
- **counter.keeb.dev** — old-school PHP hit counter (reverse proxied to php:apache container)
- **gameswiththebois.com** — static site for games group
- **www.gameswiththebois.com** — redirects to apex domain

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
Pulls the latest Docker image, extracts the generated static files, creates a timestamped directory, symlinks `site-active` to it, and restarts Caddy.

## Key Directories

- `app/web/overlay/writing/` — blog posts and associated assets
- `app/themes/cactus/` — custom theme files (heavily modified)
- `app/static/` — static assets served directly
- `conf/` — production server configs (Caddyfile, docker-compose, promtail)
- `scripts/` — deployment and utility scripts
- `app/web/config/` — **legacy** Nginx configs (no longer used, kept for reference)

## Hexo Configuration

The main Hexo config is at `app/web/overlay/_config.yml`. The project uses:
- hexo-asset-link plugin for image handling
- Custom Cactus theme with modifications
- Asset folders enabled for post-specific images

## Docker Architecture

- Multi-stage Dockerfile with Alpine base
- Development stage for creating new posts
- Production stage for building the static site
- The Dockerfile builds the Hexo site; deploy.sh extracts the output

## Theme Customization

The project uses a heavily customized version of the Cactus theme with:
- Custom visual effects and styling modifications
- Enhanced layout components for archive and index pages
- Modified CSS variables and styling partials
- Responsive design improvements
