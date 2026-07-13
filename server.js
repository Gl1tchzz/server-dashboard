const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Docker = require("dockerode");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const PORT = process.env.PORT || 4000;
const ALLOWED_CONTAINERS = (process.env.ALLOWED_CONTAINERS || "macbook-tracker,homepage,portainer,server-dashboard").split(",").map(s => s.trim()).filter(Boolean);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function cleanName(name) { return name.replace(/^\//, ""); }
function allowed(name) { return ALLOWED_CONTAINERS.includes(name); }

async function getContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map(c => ({
    id: c.Id,
    name: cleanName(c.Names[0] || ""),
    image: c.Image,
    state: c.State,
    status: c.Status
  })).filter(c => allowed(c.name));
}

app.get("/api/containers", async (req, res) => {
  try { res.json(await getContainers()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/containers/:name/:action", async (req, res) => {
  const { name, action } = req.params;
  if (!allowed(name)) return res.status(403).json({ error: "Container not allowed" });
  try {
    const container = docker.getContainer(name);
    if (action === "start") await container.start();
    else if (action === "stop") await container.stop();
    else if (action === "restart") await container.restart();
    else return res.status(400).json({ error: "Invalid action" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/deploy/macbook-tracker", (req, res) => {
  execFile("/app/deploy-scripts/auto-update-macbook-tracker.sh", [], (error, stdout, stderr) => {
    if (error) return res.status(500).json({ error: error.message, stdout, stderr });
    res.json({ ok: true, stdout, stderr });
  });
});

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const containerName = url.searchParams.get("container");
  if (!containerName || !allowed(containerName)) { ws.send("Container not allowed.\n"); ws.close(); return; }
  try {
    const container = docker.getContainer(containerName);
    const stream = await container.logs({ follow: true, stdout: true, stderr: true, tail: 150 });
    stream.on("data", chunk => {
      const text = chunk.toString("utf8").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    });
    stream.on("error", err => { if (ws.readyState === WebSocket.OPEN) ws.send(`Log error: ${err.message}\n`); });
    ws.on("close", () => { try { stream.destroy(); } catch {} });
  } catch (err) { ws.send(`Failed to read logs: ${err.message}\n`); ws.close(); }
});

server.listen(PORT, () => console.log(`Nafiul Server Dashboard running on port ${PORT}`));
