import { useEffect, useMemo, useState } from "react";
import { Boxes, Gauge, LayoutDashboard, Lock, LogOut, Server, TerminalSquare } from "lucide-react";
import { api, clearToken, getToken, setToken, websocketUrl } from "./lib/api";
import type { Project, Snapshot } from "./types";
import { MetricCard } from "./components/MetricCard";
import { ProjectCard } from "./components/ProjectCard";
import { TerminalModal } from "./components/TerminalModal";
import "./styles.css";

function bytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
}

function uptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loginToken, setLoginToken] = useState("");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [view, setView] = useState<"overview" | "projects" | "containers">("overview");
  const [terminal, setTerminal] = useState({ open: false, title: "", lines: [] as string[] });
  const [terminalSocket, setTerminalSocket] = useState<WebSocket | null>(null);

  const authenticate = async (candidate?: string) => {
    if (candidate) setToken(candidate);
    try {
      const data = await api<Snapshot>("/api/snapshot");
      setSnapshot(data);
      setAuthenticated(true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      if (candidate) clearToken();
    }
  };

  useEffect(() => {
    if (getToken()) authenticate();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const socket = new WebSocket(websocketUrl("/ws/dashboard"));
    socket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setSnapshot((current) => ({ ...current, ...update } as Snapshot));
    };
    socket.onclose = () => {
      setTimeout(() => setAuthenticated((current) => current), 2000);
    };
    return () => socket.close();
  }, [authenticated]);

  const temperature = useMemo(() => {
    if (!snapshot) return null;
    const groups = Object.values(snapshot.host.temperatures);
    return groups.flat()[0]?.current ?? null;
  }, [snapshot]);

  const openLogs = (container: string) => {
    terminalSocket?.close();
    setTerminal({ open: true, title: `${container} · live logs`, lines: [] });
    const socket = new WebSocket(websocketUrl(`/ws/logs/${encodeURIComponent(container)}`));
    socket.onmessage = (event) => {
      setTerminal((current) => ({ ...current, lines: [...current.lines.slice(-999), event.data] }));
    };
    socket.onclose = () => {
      setTerminal((current) => ({ ...current, lines: [...current.lines, "[log stream closed]"] }));
    };
    setTerminalSocket(socket);
  };

  const containerAction = async (name: string, action: "start" | "stop" | "restart") => {
    try {
      await api(`/api/containers/${encodeURIComponent(name)}/${action}`, { method: "POST" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  const deploy = async (project: Project) => {
    if (!confirm(`Deploy the newest ${project.branch ?? "main"} branch for ${project.name}?`)) return;
    try {
      const result = await api<{ id: string }>(`/api/projects/${project.id}/deploy`, { method: "POST" });
      terminalSocket?.close();
      setTerminal({ open: true, title: `${project.name} · deployment`, lines: [] });
      const socket = new WebSocket(websocketUrl(`/ws/deployments/${result.id}`));
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "line") {
          setTerminal((current) => ({ ...current, lines: [...current.lines.slice(-1999), message.line] }));
        }
        if (message.type === "status" && ["success", "failed"].includes(message.status)) {
          setTerminal((current) => ({
            ...current,
            lines: [...current.lines, "", `[deployment ${message.status}; exit code ${message.exit_code}]`]
          }));
        }
      };
      setTerminalSocket(socket);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Deployment failed");
    }
  };

  if (!authenticated) {
    return (
      <main className="login-page">
        <form
          className="login-card"
          onSubmit={(event) => {
            event.preventDefault();
            authenticate(loginToken);
          }}
        >
          <div className="logo-mark"><Server size={19} /> HOME // CONTROL</div>
          <Lock size={30} />
          <h1>Server access</h1>
          <p>Enter the private dashboard token stored on your Raspberry Pi.</p>
          <input
            value={loginToken}
            onChange={(event) => setLoginToken(event.target.value)}
            type="password"
            placeholder="Dashboard token"
            autoFocus
          />
          <button type="submit">Connect securely</button>
          {error && <div className="login-error">{error}</div>}
        </form>
      </main>
    );
  }

  if (!snapshot) return null;

  const running = snapshot.containers.filter((item) => item.status === "running").length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <div className="logo-mark"><Server size={18} /> HOME // CONTROL</div>
          <div className="live-indicator"><span /> Server online</div>
        </div>

        <nav>
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            <LayoutDashboard size={18} /> Overview
          </button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>
            <Boxes size={18} /> Projects
          </button>
          <button className={view === "containers" ? "active" : ""} onClick={() => setView("containers")}>
            <TerminalSquare size={18} /> Containers
          </button>
        </nav>

        <button
          className="logout"
          onClick={() => {
            clearToken();
            location.reload();
          }}
        >
          <LogOut size={17} /> Lock dashboard
        </button>
      </aside>

      <main className="content">
        <header className="page-header">
          <div>
            <span>RASPBERRY PI CONTROL CENTRE</span>
            <h1>{view[0].toUpperCase() + view.slice(1)}</h1>
          </div>
          <div className="header-status">
            <Gauge size={17} />
            Live · {running}/{snapshot.containers.length} containers
          </div>
        </header>

        {view === "overview" && (
          <>
            <section className="metrics-grid">
              <MetricCard label="CPU" value={`${snapshot.host.cpu_percent.toFixed(1)}%`} percent={snapshot.host.cpu_percent} subtitle={`${snapshot.host.cpu_count} cores`} />
              <MetricCard label="Memory" value={`${snapshot.host.memory.percent.toFixed(1)}%`} percent={snapshot.host.memory.percent} subtitle={`${bytes(snapshot.host.memory.used)} used`} />
              <MetricCard label="System disk" value={`${snapshot.host.root_disk.percent.toFixed(1)}%`} percent={snapshot.host.root_disk.percent} subtitle={`${bytes(snapshot.host.root_disk.free)} free`} />
              <MetricCard label="NAS storage" value={`${snapshot.host.nas_disk.percent.toFixed(1)}%`} percent={snapshot.host.nas_disk.percent} subtitle={`${bytes(snapshot.host.nas_disk.free)} free`} />
            </section>

            <section className="overview-grid">
              <article className="panel">
                <div className="panel-heading">
                  <h2>Server health</h2>
                  <span>Uptime {uptime(snapshot.host.uptime_seconds)}</span>
                </div>
                <dl className="facts">
                  <div><dt>Load average</dt><dd>{snapshot.host.load.join(" / ")}</dd></div>
                  <div><dt>Temperature</dt><dd>{temperature === null ? "Unavailable" : `${temperature.toFixed(1)}°C`}</dd></div>
                  <div><dt>Network received</dt><dd>{bytes(snapshot.host.network.bytes_recv)}</dd></div>
                  <div><dt>Network sent</dt><dd>{bytes(snapshot.host.network.bytes_sent)}</dd></div>
                  <div><dt>Swap usage</dt><dd>{snapshot.host.swap.percent.toFixed(1)}%</dd></div>
                </dl>
              </article>

              <article className="panel">
                <div className="panel-heading">
                  <h2>Project status</h2>
                  <span>{snapshot.projects.length} registered</span>
                </div>
                <div className="status-list">
                  {snapshot.projects.map((project) => {
                    const active = project.container_statuses.some((container) => container.status === "running");
                    return (
                      <div key={project.id}>
                        <strong>{project.name}</strong>
                        <span className={`state ${active ? "running" : "stopped"}`}>{active ? "Running" : "Stopped"}</span>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="panel wide">
                <div className="panel-heading">
                  <h2>Recent activity</h2>
                  <span>Persisted locally</span>
                </div>
                <div className="event-list">
                  {(snapshot.events ?? []).length === 0 && <p className="empty">No recorded activity yet.</p>}
                  {(snapshot.events ?? []).map((event) => (
                    <div key={event.id}>
                      <span className={`event-dot ${event.status}`} />
                      <div><strong>{event.title}</strong><small>{event.category} · {new Date(event.created_at * 1000).toLocaleString()}</small></div>
                      <span>{event.status}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}

        {view === "projects" && (
          <section className="projects-grid">
            {snapshot.projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onAction={containerAction}
                onLogs={openLogs}
                onDeploy={deploy}
              />
            ))}
          </section>
        )}

        {view === "containers" && (
          <section className="panel containers-panel">
            <div className="panel-heading">
              <h2>Docker containers</h2>
              <span>{snapshot.containers.length} total</span>
            </div>
            <div className="container-table">
              {snapshot.containers.map((container) => (
                <div className="container-row" key={container.name}>
                  <div>
                    <strong>{container.name}</strong>
                    <span className={`state ${container.status === "running" ? "running" : "stopped"}`}>{container.status}</span>
                  </div>
                  <code>{container.image}</code>
                  <span>{container.health || "No healthcheck"}</span>
                  <span>{container.restart_count ?? 0} restarts</span>
                  <div className="row-actions">
                    <button onClick={() => openLogs(container.name)}>Logs</button>
                    {container.status === "running" ? (
                      <>
                        <button onClick={() => containerAction(container.name, "restart")}>Restart</button>
                        <button onClick={() => containerAction(container.name, "stop")}>Stop</button>
                      </>
                    ) : (
                      <button onClick={() => containerAction(container.name, "start")}>Start</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <TerminalModal
        open={terminal.open}
        title={terminal.title}
        lines={terminal.lines}
        onClose={() => {
          terminalSocket?.close();
          setTerminal((current) => ({ ...current, open: false }));
        }}
      />
    </div>
  );
}
