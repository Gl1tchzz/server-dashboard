# Nafiul Server Dashboard v2

A private home-server control centre for Raspberry Pi and Docker.

## Features

- Token authentication
- Live CPU, RAM, temperature, disk, NAS and network statistics
- Docker container discovery
- Start, stop and restart containers
- Live container logs over WebSockets
- Project registry
- Allow-listed deployment scripts
- Live deployment output
- Responsive React interface
- Tailscale-friendly deployment
- Persistent SQLite event history
- Health endpoint

## Security

This application mounts `/var/run/docker.sock`, which grants powerful control over Docker.
Keep it private behind Tailscale or a trusted LAN. Do not expose port 8088 through your router.

## Raspberry Pi installation

```bash
sudo mkdir -p /opt/docker/server-dashboard
sudo chown -R "$USER":"$USER" /opt/docker/server-dashboard
cd /opt/docker/server-dashboard
```

Copy the project contents into that directory, then:

```bash
cp .env.example .env
openssl rand -hex 32
nano .env
```

Set the generated value as `DASHBOARD_TOKEN`.

Build and start:

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

Open:

```text
http://YOUR_TAILSCALE_IP:8088
```

Allow through UFW only on Tailscale:

```bash
sudo ufw allow in on tailscale0 to any port 8088 proto tcp
```

## Register projects

Edit:

```text
config/projects.yaml
```

Each project supports:

```yaml
- id: macbook-tracker
  name: MacBook Tracker
  description: eBay deal detection and Discord notifications
  repository: https://github.com/Gl1tchzz/eBayDealDetectionSystem
  branch: main
  compose_dir: /opt/docker/macbook-tracker/app
  deploy_script: /opt/docker/macbook-tracker/deploy.sh
  url: ""
  containers:
    - macbook-tracker
```

Only deployment scripts explicitly listed in this file may be executed.

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
