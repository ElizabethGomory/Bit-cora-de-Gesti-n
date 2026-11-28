"use client";

import { createClient } from "@/lib/supabase/client";
import { db, isoNow, type SyncJobRecord } from "@/lib/offline/db";

type EntityMap = {
  categories: "categories";
  projects: "projects";
  tasks: "project_tasks";
  templates: "task_templates";
  timeLogs: "time_logs";
};

const TABLES: EntityMap = {
  categories: "categories",
  projects: "projects",
  tasks: "project_tasks",
  templates: "task_templates",
  timeLogs: "time_logs",
};

function toRemote(
  entity: SyncJobRecord["entity"],
  payload: Record<string, unknown>,
  userId: string,
): Record<string, unknown> {
  if (entity === "categories") {
    return {
      id: payload.id,
      user_id: userId,
      name: payload.name,
      color: payload.color,
      is_default: payload.isDefault,
      hourly_rate_override: payload.hourlyRateOverride ?? null,
    };
  }
  if (entity === "projects") {
    return {
      id: payload.id,
      user_id: userId,
      category_id: payload.categoryId,
      title: payload.title,
      client_or_context: payload.clientOrContext || null,
      authorship_type: payload.authorshipType,
      status: payload.status,
      start_date: payload.startDate,
      end_date: payload.endDate || null,
      budget_quoted: payload.budgetQuoted,
    };
  }
  if (entity === "tasks") {
    return {
      id: payload.id,
      user_id: userId,
      project_id: payload.projectId,
      title: payload.title,
      estimated_hours: payload.estimatedHours,
      logged_hours: payload.loggedHours,
      is_completed: payload.isCompleted,
      auto_estimated: payload.autoEstimated,
    };
  }
  if (entity === "templates") {
    return { id: payload.id, user_id: userId, name: payload.name };
  }
  return {
    id: payload.id,
    user_id: userId,
    project_id: payload.projectId,
    task_id: payload.taskId || null,
    log_date: payload.logDate,
    duration_hours: payload.durationHours,
    notes: payload.notes || null,
  };
}

export async function queueSync(
  entity: SyncJobRecord["entity"],
  action: SyncJobRecord["action"],
  payload: Record<string, unknown>,
) {
  await db.syncJobs.add({
    id: crypto.randomUUID(),
    entity,
    action,
    payload,
    attempts: 0,
    createdAt: isoNow(),
  });
}

export async function flushSyncJobs() {
  if (!navigator.onLine) return { synced: 0, pending: await db.syncJobs.count() };

  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return { synced: 0, pending: await db.syncJobs.count() };

  let synced = 0;
  const jobs = await db.syncJobs.orderBy("createdAt").toArray();
  for (const job of jobs) {
    try {
      const table = TABLES[job.entity];
      if (job.action === "delete") {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id", String(job.payload.id));
        if (error) throw error;
      } else {
        const record = toRemote(job.entity, job.payload, session.user.id);
        let error: { message: string } | null = null;
        if (job.entity === "categories") {
          const result = await supabase.from("categories").upsert(record);
          error = result.error;
        } else if (job.entity === "projects") {
          const result = await supabase.from("projects").upsert(record);
          error = result.error;
        } else if (job.entity === "tasks") {
          const result = await supabase.from("project_tasks").upsert(record);
          error = result.error;
        } else if (job.entity === "templates") {
          const result = await supabase.from("task_templates").upsert(record);
          error = result.error;
        } else {
          const result = await supabase.from("time_logs").upsert(record);
          error = result.error;
        }
        if (error) throw error;
      }
      await db.syncJobs.delete(job.id);
      synced += 1;
    } catch (error) {
      await db.syncJobs.update(job.id, {
        attempts: job.attempts + 1,
        lastError: error instanceof Error ? error.message : "Error de sincronización",
      });
    }
  }
  return { synced, pending: await db.syncJobs.count() };
}
