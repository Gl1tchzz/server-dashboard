# Raspberry Pi Server Dashboard

A private dashboard for a Raspberry Pi Docker server. It shows live server health, Docker container health, project status, live logs, manual start/stop/restart controls, and one-click or GitHub-triggered project updates.

## What It Does

- Token-protected dashboard
- Live CPU, RAM, swap, temperature, root disk, NAS disk and network usage
- Docker container discovery with status, healthcheck and restart count
- Start, stop and restart buttons for containers
- Live logs for every registered container
- Manual "Force latest deploy" button per project
- GitHub push webhook auto-deploys matching projects when their configured branch is updated
- Persistent SQLite activity history
- Tailscale-friendly private access

## Important Security Note

The dashboard mounts `/var/run/docker.sock`, which means it can control Docker on the host. Keep it private behind Tailscale or a trusted LAN. Do not expose port `8088` directly on your router.

## 1. Prepare The Raspberry Pi

Install Docker and Tailscale:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Log out and back in so your user can run Docker.

Create the folders used by this dashboard and your projects:

```bash
sudo mkdir -p /opt/docker /srv/nas
sudo chown -R "$USER":"$USER" /opt/docker
```

Clone this dashboard:

```bash
cd /opt/docker
git clone https://github.com/Gl1tchzz/server-dashboard.git
cd /opt/docker/server-dashboard
```

## 2. Configure Secrets

Create `.env`:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
nano .env
```

Use one generated value for `DASHBOARD_TOKEN` and the other for `GITHUB_WEBHOOK_SECRET`.

Example:

```env
DASHBOARD_TOKEN=your-private-login-token
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
PROJECTS_FILE=/app/config/projects.yaml
DATABASE_PATH=/app/data/dashboard.db
HOST_PROC=/host/proc
HOST_SYS=/host/sys
HOST_ROOT=/host/root
HOST_NAS=/host/nas
```

## 3. Register Projects

Edit `config/projects.yaml`:

```yaml
projects:
  - id: ebay-deal-detection
    name: eBay Deal Detection
    description: eBay deal detection and notifications
    repository: https://github.com/Gl1tchzz/eBayDealDetectionSystem
    branch: main
    auto_deploy: true
    compose_dir: /opt/docker/ebay-deal-detection
    deploy_script: /app/scripts/deploy-project.sh
    url: ""
    containers:
      - ebay-deal-detection
```

Each project needs:

- `repository`: GitHub repo URL
- `branch`: branch to deploy, usually `main`
- `auto_deploy`: `true` to deploy on GitHub push webhooks
- `compose_dir`: folder on the Pi containing that project checkout and `compose.yaml` or `docker-compose.yml`
- `deploy_script`: usually `/app/scripts/deploy-project.sh`
- `containers`: Docker container names to show logs/buttons for

For each project, clone it into the configured folder:

```bash
cd /opt/docker
git clone https://github.com/Gl1tchzz/eBayDealDetectionSystem.git ebay-deal-detection
cd /opt/docker/ebay-deal-detection
docker compose config --quiet
```

## 4. Start The Dashboard

```bash
cd /opt/docker/server-dashboard
mkdir -p data
docker compose build
docker compose up -d
docker compose logs -f dashboard
```

Open it over your tailnet:

```text
http://YOUR_PI_TAILSCALE_IP:8088
```

Find the Pi Tailscale IP:

```bash
tailscale ip -4
```

If you use UFW, allow only Tailscale traffic:

```bash
sudo ufw allow in on tailscale0 to any port 8088 proto tcp
```

## 5. Enable GitHub Auto-Deploy

The dashboard webhook endpoint is:

```text
https://YOUR_PUBLIC_OR_FUNNEL_URL/api/webhooks/github
```

GitHub needs to reach that URL. You have two common options:

1. Tailscale Funnel for a public HTTPS URL:

```bash
sudo tailscale funnel --bg 8088
tailscale funnel status
```

2. Keep the dashboard private and use GitHub Actions with Tailscale SSH to run a deploy command instead of webhooks.

For GitHub webhooks, go to the repository:

```text
Settings -> Webhooks -> Add webhook
```

Use:

- Payload URL: `https://YOUR_PUBLIC_OR_FUNNEL_URL/api/webhooks/github`
- Content type: `application/json`
- Secret: the same value as `GITHUB_WEBHOOK_SECRET`
- Events: `Just the push event`
- Active: checked

When GitHub sends a push for `main`, the dashboard matches the repo URL and branch in `config/projects.yaml`, then runs `/app/scripts/deploy-project.sh`.

## Manual Deploys

Press `Force latest deploy` on any project card. The deploy script will:

```text
git fetch origin main
git reset --hard origin/main
docker compose config --quiet
docker compose pull --ignore-pull-failures
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f
```

You will see the live deployment output in the dashboard terminal modal.

## Updating The Dashboard Itself

This dashboard can update itself if the `server-dashboard` project entry points at `/opt/docker/server-dashboard` and uses `/app/scripts/deploy-project.sh`. During a self-update the current deployment log can disconnect while Docker recreates the dashboard container; refresh the page after a minute.

## Development

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8088
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
