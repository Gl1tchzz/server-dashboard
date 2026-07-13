import { ExternalLink, Github, Play, RotateCcw, Square, Terminal, UploadCloud } from "lucide-react";
import type { Project } from "../types";

type Props = {
  project: Project;
  onAction: (container: string, action: "start" | "stop" | "restart") => void;
  onLogs: (container: string) => void;
  onDeploy: (project: Project) => void;
};

export function ProjectCard({ project, onAction, onLogs, onDeploy }: Props) {
  const running = project.container_statuses.some((item) => item.status === "running");

  return (
    <article className="project-card">
      <div className="project-heading">
        <div>
          <div className={`status-pill ${running ? "running" : "stopped"}`}>
            {running ? "Running" : "Stopped"}
          </div>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
        </div>
      </div>

      <div className="container-tags">
        {project.container_statuses.map((container) => (
          <span key={container.name}>
            {container.name} · {container.status}
          </span>
        ))}
      </div>

      <div className="project-links">
        {project.repository && (
          <a href={project.repository} target="_blank" rel="noreferrer">
            <Github size={15} /> Repository
          </a>
        )}
        {project.url && (
          <a href={project.url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Open
          </a>
        )}
      </div>

      <div className="project-actions">
        {project.container_statuses.map((container) => (
          <div className="container-actions" key={container.name}>
            <button onClick={() => onLogs(container.name)}><Terminal size={15} /> Logs</button>
            {container.status === "running" ? (
              <>
                <button onClick={() => onAction(container.name, "restart")}><RotateCcw size={15} /> Restart</button>
                <button onClick={() => onAction(container.name, "stop")}><Square size={15} /> Stop</button>
              </>
            ) : (
              <button onClick={() => onAction(container.name, "start")}><Play size={15} /> Start</button>
            )}
          </div>
        ))}
        {project.deploy_script && (
          <button className="deploy-button" onClick={() => onDeploy(project)}>
            <UploadCloud size={16} /> Force latest deploy
          </button>
        )}
      </div>
    </article>
  );
}
