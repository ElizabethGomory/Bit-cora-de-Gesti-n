"use client";

import Dexie, { type Table } from "dexie";

export interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  hourlyRateOverride?: number | null;
  isDefault: boolean;
  updatedAt: string;
  deletedAt?: string;
}

export interface ProjectRecord {
  id: string;
  categoryId: string;
  title: string;
  clientOrContext: string;
  authorshipType: "solo" | "team_external_idea" | "enterprise" | "mentorship";
  status: "active" | "paused" | "completed";
  startDate: string;
  endDate: string | null;
  budgetQuoted: number | null;
  updatedAt: string;
  deletedAt?: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  estimatedHours: number;
  loggedHours: number;
  isCompleted: boolean;
  autoEstimated: boolean;
  updatedAt: string;
  deletedAt?: string;
}

export interface TaskTemplateRecord {
  id: string;
  name: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface TimeLogRecord {
  id: string;
  projectId: string;
  taskId: string | null;
  logDate: string;
  durationHours: number;
  notes: string;
  syncedAt?: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SyncJobRecord {
  id: string;
  entity: "categories" | "projects" | "tasks" | "templates" | "timeLogs";
  action: "upsert" | "delete";
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

export interface TimerRecord {
  id: "active";
  projectId: string | null;
  taskId: string | null;
  startedAt: number;
}

export interface SettingsRecord {
  id: "app";
  monthlyAvailableHours: number;
  estimateBufferPercent: number;
  defaultHourlyRate: number;
}

class BitacoraDatabase extends Dexie {
  categories!: Table<CategoryRecord, string>;
  projects!: Table<ProjectRecord, string>;
  tasks!: Table<TaskRecord, string>;
  templates!: Table<TaskTemplateRecord, string>;
  timeLogs!: Table<TimeLogRecord, string>;
  syncJobs!: Table<SyncJobRecord, string>;
  timer!: Table<TimerRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super("bitacora-studio");
    this.version(2).stores({
      categories: "id, name, updatedAt, deletedAt",
      projects: "id, categoryId, status, updatedAt, deletedAt",
      tasks: "id, projectId, isCompleted, updatedAt, deletedAt",
      templates: "id, name, updatedAt, deletedAt",
      timeLogs: "id, projectId, taskId, logDate, updatedAt, deletedAt",
      syncJobs: "id, entity, action, createdAt",
      timer: "id",
      settings: "id",
    });
  }
}

export const db = new BitacoraDatabase();

export function newId() {
  return crypto.randomUUID();
}

export const isoNow = () => new Date().toISOString();

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
