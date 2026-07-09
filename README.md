# Nafiul Server Dashboard

A lightweight dashboard for Docker project status, controls, deployments, and live terminal logs.

## Run with Docker Compose

Add this service to `/mnt/NAS/server/infrastructure/compose/docker-compose.yml`:

```yaml
  server-dashboard:
    build: /mnt/NAS/server/projects/server-dashboard
    container_name: server-dashboard
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      ALLOWED_CONTAINERS: "macbook-tracker,homepage,portainer,server-dashboard"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /mnt/NAS/server/infrastructure/scripts:/mnt/NAS/server/infrastructure/scripts
```

Open: `http://YOUR_PI_IP:4000`

## Security

This dashboard can control Docker. Keep it private on your home network.
# server-dashboard
