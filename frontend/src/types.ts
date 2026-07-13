export type Container = {
  id?: string;
  name: string;
  image?: string;
  status: string;
  health?: string | null;
  restart_count?: number;
  project?: string;
  service?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  repository?: string;
  branch?: string;
  auto_deploy?: boolean;
  compose_dir?: string;
  deploy_script?: string;
  url?: string;
  container_statuses: Container[];
};

export type HostStats = {
  cpu_percent: number;
  cpu_count: number;
  load: number[];
  memory: { total: number; used: number; available: number; percent: number };
  swap: { total: number; used: number; percent: number };
  root_disk: { total: number; used: number; free: number; percent: number };
  nas_disk: { total: number; used: number; free: number; percent: number };
  uptime_seconds: number;
  temperatures: Record<string, Array<{ label: string; current: number }>>;
  network: { bytes_sent: number; bytes_recv: number };
  timestamp: number;
};

export type Snapshot = {
  host: HostStats;
  containers: Container[];
  projects: Project[];
  events?: Array<{
    id: number;
    created_at: number;
    category: string;
    title: string;
    status: string;
  }>;
};
