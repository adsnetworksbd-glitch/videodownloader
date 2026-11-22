export type HudJob = { id: string; title: string; status: string; at: number };

const KEY = "gateway.jobs";
export const JOBS_EVENT = "gateway:jobs";
export const TERMINAL = new Set(["ready", "completed", "failed"]);

export function loadHudJobs(): HudJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HudJob[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveHudJobs(jobs: HudJob[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(jobs.slice(0, 20)));
  window.dispatchEvent(new Event(JOBS_EVENT));
}

export function registerHudJob(job: HudJob): void {
  saveHudJobs([job, ...loadHudJobs().filter((j) => j.id !== job.id)]);
}

export function updateHudJob(id: string, status: string): void {
  const jobs = loadHudJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job || job.status === status) return;
  job.status = status;
  saveHudJobs(jobs);
}
