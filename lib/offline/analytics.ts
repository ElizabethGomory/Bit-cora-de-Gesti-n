import { localDate, type CategoryRecord, type ProjectRecord, type TaskRecord, type TimeLogRecord } from "@/lib/offline/db";

export function normalizeTaskTitle(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function getWeekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export function calculateAnalytics(
  logs: TimeLogRecord[],
  projects: ProjectRecord[],
  categories: CategoryRecord[],
  tasks: TaskRecord[],
  now = new Date(),
) {
  const weekStart = localDate(getWeekStart(now));
  const today = localDate(now);
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const sum = (items: TimeLogRecord[]) => items.reduce((total, log) => total + log.durationHours, 0);

  const projectHours = new Map<string, number>();
  const categoryHours = new Map<string, number>();
  for (const log of logs) {
    projectHours.set(log.projectId, (projectHours.get(log.projectId) ?? 0) + log.durationHours);
    const categoryId = projectMap.get(log.projectId)?.categoryId;
    if (categoryId) categoryHours.set(categoryId, (categoryHours.get(categoryId) ?? 0) + log.durationHours);
  }

  const taskBenchmarks = new Map<string, { categoryId: string; title: string; hours: number; samples: number }>();
  for (const task of tasks) {
    if (task.loggedHours <= 0) continue;
    const categoryId = projectMap.get(task.projectId)?.categoryId;
    if (!categoryId) continue;
    const normalizedTitle = normalizeTaskTitle(task.title);
    const key = `${categoryId}:${normalizedTitle}`;
    const benchmark = taskBenchmarks.get(key) ?? { categoryId, title: task.title.trim(), hours: 0, samples: 0 };
    benchmark.hours += task.loggedHours;
    benchmark.samples += 1;
    taskBenchmarks.set(key, benchmark);
  }

  const projectBreakdown = [...projectHours].map(([projectId, hours]) => ({
    projectId,
    title: projectMap.get(projectId)?.title ?? "Proyecto eliminado",
    categoryId: projectMap.get(projectId)?.categoryId ?? "",
    hours,
  })).sort((a, b) => b.hours - a.hours);

  const categoryBreakdown = [...categoryHours].map(([categoryId, hours]) => ({
    categoryId,
    name: categoryMap.get(categoryId)?.name ?? "Rubro eliminado",
    color: categoryMap.get(categoryId)?.color ?? "#A1A1A1",
    hours,
  })).sort((a, b) => b.hours - a.hours);

  return {
    todayHours: sum(logs.filter((log) => log.logDate === today)),
    weekHours: sum(logs.filter((log) => log.logDate >= weekStart && log.logDate <= today)),
    totalHours: sum(logs),
    projectBreakdown,
    categoryBreakdown,
    benchmarks: [...taskBenchmarks.values()]
      .map((benchmark) => ({
        ...benchmark,
        averageHours: benchmark.hours / benchmark.samples,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}

export function calculateMonthlyLoad(projects: ProjectRecord[], tasks: TaskRecord[]) {
  return projects
    .filter((project) => project.status === "active")
    .map((project) => ({
      projectId: project.id,
      title: project.title,
      remainingHours: tasks
        .filter((task) => task.projectId === project.id && !task.isCompleted)
        .reduce((sum, task) => sum + Math.max(task.estimatedHours - task.loggedHours, 0), 0),
    }))
    .sort((a, b) => b.remainingHours - a.remainingHours);
}

export function suggestedHours(benchmarkHours: number, bufferPercent: number) {
  const safeBufferPercent = Math.min(Math.max(bufferPercent, 0), 100);
  return Math.round(benchmarkHours * (1 + safeBufferPercent / 100) * 100) / 100;
}
