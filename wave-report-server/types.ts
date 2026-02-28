// types.ts — Shared type definitions for wave report server

export interface TaskData {
  status: "pending" | "in_progress" | "completed";
  description?: string;
  steps?: string[];
  completed_steps?: string[];
  blockedBy?: string[];
  owner?: string | null;
  metadata?: Record<string, any>;
}

export interface WaveData {
  id: number;
  name?: string;
  description?: string;
  tasks?: string[];
  status?: string;
  report?: string | null;
}

export interface Learning {
  id?: string;
  timestamp?: string;
  text?: string;
}

export interface BeforeAfter {
  before: string;
  after: string;
}

export interface ProgressData {
  harness?: string;
  mission?: string;
  status?: string;
  started_at?: string;
  session_count?: number;
  sketch_approved?: boolean;
  tasks?: Record<string, TaskData>;
  waves?: WaveData[];
  learnings?: Learning[];
  commits?: any[];
  state?: {
    beforeAfter?: BeforeAfter[];
    [key: string]: any;
  };
  current_session?: {
    round_count?: number;
    tasks_completed?: number;
    started_at?: string;
  };
}

export interface ManifestData {
  harness: string;
  project_root: string;
  status: string;
  created_at?: string;
  files: {
    progress?: string;
    [key: string]: string | undefined;
  };
  reports_dir?: string;
}

export interface RegistryEntry {
  harness: string;
  status: string;
  projectRoot: string;
  progressPath: string;   // absolute path
  screenshotsDir: string | null; // absolute path or null
  tasksDone: number;
  tasksTotal: number;
  issues: string[];
}

export interface Registry {
  scanned_at: string;
  entries: RegistryEntry[];
}
