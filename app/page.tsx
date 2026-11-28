"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BriefcaseBusiness, Clock3, FolderPlus, LayoutDashboard, ListTodo, Plus, Timer } from "lucide-react";
import { calculateAnalytics, calculateMonthlyLoad, normalizeTaskTitle, suggestedHours } from "@/lib/offline/analytics";
import { db, isoNow, localDate, newId, type CategoryRecord, type ProjectRecord, type SettingsRecord, type TaskRecord, type TimeLogRecord } from "@/lib/offline/db";
import { flushSyncJobs, queueSync } from "@/lib/offline/sync";

type Tab = "dashboard" | "projects" | "tasks" | "catalog" | "analytics" | "quote";

const defaultCategories = [
  ["Web / Apps", "#FF9A00"],
  ["UI / UX", "#8B5CF6"],
  ["Ciencia de Datos", "#06B6D4"],
  ["Videojuegos", "#EC4899"],
  ["Agénticos / Multiagénticos", "#10B981"],
  ["Mentorías", "#F59E0B"],
  ["Robótica", "#6366F1"],
  ["Otros", "#A1A1A1"],
] as const;

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogRecord[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [templateRows, setTemplateRows] = useState<{ id: string; name: string }[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRecord[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#FF9A00");
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<SettingsRecord>({
    id: "app",
    monthlyAvailableHours: 160,
    estimateBufferPercent: 20,
    defaultHourlyRate: 50,
  });
  const [quoteCategoryId, setQuoteCategoryId] = useState("");
  const [quoteItems, setQuoteItems] = useState<{ id: string; title: string; hours: number }[]>([]);
  const [quoteTaskTitle, setQuoteTaskTitle] = useState("");
  const [quoteTaskHours, setQuoteTaskHours] = useState("");

  async function refresh() {
    const [projectRows, taskRows, logRows, categoryRows, templateRows, syncCount, timer, storedSettings] = await Promise.all([
      db.projects.toArray(),
      db.tasks.toArray(),
      db.timeLogs.toArray(),
      db.categories.toArray(),
      db.templates.toArray(),
      db.syncJobs.count(),
      db.timer.get("active"),
      db.settings.get("app"),
    ]);
    if (!storedSettings) {
      const defaults: SettingsRecord = {
        id: "app",
        monthlyAvailableHours: 160,
        estimateBufferPercent: 20,
        defaultHourlyRate: 50,
      };
      await db.settings.put(defaults);
      setSettings(defaults);
    } else {
      setSettings(storedSettings);
    }
    setProjects(projectRows.filter((row) => !row.deletedAt));
    setTasks(taskRows.filter((row) => !row.deletedAt));
    setTimeLogs(logRows.filter((row) => !row.deletedAt));
    setCategories(Object.fromEntries(categoryRows.filter((row) => !row.deletedAt).map((row) => [row.id, row.name])));
    setCategoryRows(categoryRows.filter((row) => !row.deletedAt));
    setRateDrafts(Object.fromEntries(categoryRows.filter((row) => !row.deletedAt).map((row) => [
      row.id,
      row.hourlyRateOverride == null ? "" : String(row.hourlyRateOverride),
    ])));
    setTemplates(templateRows.filter((row) => !row.deletedAt).map((row) => row.name));
    setTemplateRows(templateRows.filter((row) => !row.deletedAt).map((row) => ({ id: row.id, name: row.name })));
    setPending(syncCount);
    if (timer?.startedAt) {
      setSelectedProjectId(timer.projectId || "");
      setSelectedTaskId(timer.taskId || "");
      setStartedAt(timer.startedAt);
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      void flushSyncJobs().then(refresh);
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void (async () => {
      if (await db.categories.count() === 0) {
        await db.categories.bulkAdd(
          defaultCategories.map(([name, color]) => ({
            id: newId(),
            name,
            color,
            hourlyRateOverride: null,
            isDefault: true,
            updatedAt: isoNow(),
          })),
        );
      }
      const firstCategory = await db.categories.orderBy("name").first();
      if (firstCategory) setQuoteCategoryId(firstCategory.id);
      await refresh();
      await flushSyncJobs();
      await refresh();
    })();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Date.now() - startedAt);
    const interval = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status === "active"), [projects]);
  const projectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === selectedProjectId),
    [tasks, selectedProjectId],
  );
  const today = localDate();
  const analytics = useMemo(
    () => calculateAnalytics(timeLogs, projects, categoryRows, tasks),
    [timeLogs, projects, categoryRows, tasks],
  );
  const monthlyLoad = useMemo(() => calculateMonthlyLoad(projects, tasks), [projects, tasks]);
  const estimatedMonthlyHours = monthlyLoad.reduce((sum, project) => sum + project.remainingHours, 0);
  const monthlyCapacityPercent = settings.monthlyAvailableHours > 0
    ? (estimatedMonthlyHours / settings.monthlyAvailableHours) * 100
    : estimatedMonthlyHours > 0 ? 100 : 0;
  const selectedProjectCategory = projects.find((project) => project.id === selectedProjectId)?.categoryId;
  const taskBenchmark = newTaskTitle.trim()
    ? analytics.benchmarks.find((benchmark) =>
        benchmark.categoryId === selectedProjectCategory
        && normalizeTaskTitle(benchmark.title) === normalizeTaskTitle(newTaskTitle))
    : undefined;
  const suggestedEstimate = taskBenchmark
    ? suggestedHours(taskBenchmark.averageHours, settings.estimateBufferPercent)
    : null;
  const quoteRate = categoryRows.find((category) => category.id === quoteCategoryId)?.hourlyRateOverride ?? settings.defaultHourlyRate;
  const quoteHours = quoteItems.reduce((sum, item) => sum + item.hours, 0);
  const quoteEstimatedHours = suggestedHours(quoteHours, settings.estimateBufferPercent);
  const quoteTotal = quoteEstimatedHours * quoteRate;
  const quoteBenchmark = quoteTaskTitle.trim()
    ? analytics.benchmarks.find((benchmark) =>
        benchmark.categoryId === quoteCategoryId
        && normalizeTaskTitle(benchmark.title) === normalizeTaskTitle(quoteTaskTitle))
    : undefined;

  async function addProject() {
    if (!newProjectTitle.trim() || !newProjectCategory) return;
    const project: ProjectRecord = {
      id: newId(),
      categoryId: newProjectCategory,
      title: newProjectTitle.trim(),
      clientOrContext: "",
      authorshipType: "solo",
      status: "active",
      startDate: today,
      endDate: null,
      budgetQuoted: null,
      updatedAt: isoNow(),
    };
    await db.projects.add(project);
    await queueSync("projects", "upsert", project as unknown as Record<string, unknown>);
    setNewProjectTitle("");
    await flushSyncJobs();
    await refresh();
  }

  async function deleteProject(projectId: string) {
    await db.projects.update(projectId, { deletedAt: isoNow() });
    await queueSync("projects", "delete", { id: projectId });
    await flushSyncJobs();
    await refresh();
  }

  async function updateProjectStatus(project: ProjectRecord) {
    const status: ProjectRecord["status"] =
      project.status === "active" ? "paused" : project.status === "paused" ? "completed" : "active";
    const updated: ProjectRecord = { ...project, status, updatedAt: isoNow() };
    await db.projects.put(updated);
    await queueSync("projects", "upsert", updated as unknown as Record<string, unknown>);
    await flushSyncJobs();
    await refresh();
  }

  async function addTask() {
    if (!selectedProjectId || !newTaskTitle.trim()) return;
    const task: TaskRecord = {
      id: newId(),
      projectId: selectedProjectId,
      title: newTaskTitle.trim(),
      estimatedHours: suggestedEstimate ?? 0,
      loggedHours: 0,
      isCompleted: false,
      autoEstimated: false,
      updatedAt: isoNow(),
    };
    await db.tasks.add(task);
    await queueSync("tasks", "upsert", task as unknown as Record<string, unknown>);
    setNewTaskTitle("");
    await flushSyncJobs();
    await refresh();
  }

  async function createTaskFromTemplate(templateName: string) {
    if (!selectedProjectId) return;
    const task: TaskRecord = {
      id: newId(),
      projectId: selectedProjectId,
      title: templateName,
      estimatedHours: 0,
      loggedHours: 0,
      isCompleted: false,
      autoEstimated: false,
      updatedAt: isoNow(),
    };
    await db.tasks.add(task);
    await queueSync("tasks", "upsert", task as unknown as Record<string, unknown>);
    await flushSyncJobs();
    await refresh();
  }

  async function toggleTask(task: TaskRecord) {
    const loggedHours = task.loggedHours;
    const updated: TaskRecord = {
      ...task,
      isCompleted: !task.isCompleted,
      estimatedHours: !task.isCompleted && task.estimatedHours === 0 ? loggedHours : task.estimatedHours,
      autoEstimated: !task.isCompleted && task.estimatedHours === 0 && loggedHours > 0,
      updatedAt: isoNow(),
    };
    await db.tasks.put(updated);
    await queueSync("tasks", "upsert", updated as unknown as Record<string, unknown>);
    await flushSyncJobs();
    await refresh();
  }

  async function deleteTask(taskId: string) {
    await db.tasks.update(taskId, { deletedAt: isoNow() });
    await queueSync("tasks", "delete", { id: taskId });
    await flushSyncJobs();
    await refresh();
  }

  async function saveTemplate() {
    if (!newTemplateName.trim()) return;
    const template = { id: newId(), name: newTemplateName.trim(), updatedAt: isoNow() };
    await db.templates.add(template);
    await queueSync("templates", "upsert", template);
    setNewTemplateName("");
    await flushSyncJobs();
    await refresh();
  }

  async function deleteTemplate(templateId: string) {
    await db.templates.update(templateId, { deletedAt: isoNow() });
    await queueSync("templates", "delete", { id: templateId });
    await flushSyncJobs();
    await refresh();
  }

  async function saveCategory() {
    if (!newCategoryName.trim()) return;
    const category = {
      id: newId(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
      hourlyRateOverride: null,
      isDefault: false,
      updatedAt: isoNow(),
    };
    await db.categories.add(category);
    await queueSync("categories", "upsert", category);
    setNewCategoryName("");
    await flushSyncJobs();
    await refresh();
  }

  async function deleteCategory(categoryId: string) {
    await db.categories.update(categoryId, { deletedAt: isoNow() });
    await queueSync("categories", "delete", { id: categoryId });
    await flushSyncJobs();
    await refresh();
  }

  async function saveSettings(patch: Partial<Omit<SettingsRecord, "id">>) {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await db.settings.put(updated);
  }

  async function saveCategoryRate(category: CategoryRecord, rawRate: string) {
    const hourlyRateOverride = rawRate.trim() === "" ? null : Number(rawRate);
    if (hourlyRateOverride !== null && (!Number.isFinite(hourlyRateOverride) || hourlyRateOverride < 0)) return;
    const updated = { ...category, hourlyRateOverride, updatedAt: isoNow() };
    await db.categories.put(updated);
    await queueSync("categories", "upsert", updated as unknown as Record<string, unknown>);
    await flushSyncJobs();
    await refresh();
  }

  function addQuoteItem() {
    const title = quoteTaskTitle.trim();
    const hours = Number(quoteTaskHours);
    if (!title || !Number.isFinite(hours) || hours <= 0) return;
    setQuoteItems((items) => [...items, { id: newId(), title, hours }]);
    setQuoteTaskTitle("");
    setQuoteTaskHours("");
  }

  async function startTimer() {
    if (!selectedProjectId) return;
    const now = Date.now();
    await db.timer.put({ id: "active", projectId: selectedProjectId, taskId: selectedTaskId || null, startedAt: now });
    setStartedAt(now);
  }

  async function stopTimer() {
    if (!startedAt) return;
    const durationHours = Math.max(Math.round(((Date.now() - startedAt) / 3600000) * 100) / 100, 0.01);
    const log: TimeLogRecord = {
      id: newId(),
      projectId: selectedProjectId,
      taskId: selectedTaskId || null,
      logDate: today,
      durationHours,
      notes: "",
      updatedAt: isoNow(),
    };
    await db.timeLogs.add(log);
    if (selectedTaskId) {
      const task = await db.tasks.get(selectedTaskId);
      if (task) {
        const loggedHours = task.loggedHours + durationHours;
        const updated = {
          ...task,
          loggedHours,
          estimatedHours: task.estimatedHours === 0 && loggedHours > 0 ? loggedHours : task.estimatedHours,
          autoEstimated: task.autoEstimated || (task.estimatedHours === 0 && loggedHours > 0),
          updatedAt: isoNow(),
        };
        await db.tasks.put(updated);
        await queueSync("tasks", "upsert", updated as unknown as Record<string, unknown>);
      }
    }
    await queueSync("timeLogs", "upsert", log as unknown as Record<string, unknown>);
    await db.timer.clear();
    setStartedAt(null);
    setElapsed(0);
    await flushSyncJobs();
    await refresh();
  }

  const navigation = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "projects" as const, label: "Proyectos", icon: BriefcaseBusiness },
    { id: "tasks" as const, label: "Tareas", icon: Clock3 },
    { id: "catalog" as const, label: "Catálogo", icon: ListTodo },
    { id: "analytics" as const, label: "Analítica", icon: BarChart3 },
    { id: "quote" as const, label: "Cotizador", icon: FolderPlus },
  ];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="glass-panel z-10 flex w-full flex-col border-b border-white/10 p-5 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <Link href="/" className="mb-8 inline-flex items-center">
          <Image src="/images/logo.svg" alt="" width={40} height={40} priority className="mr-2 h-10 w-10" />
          <Image src="/images/isotipo.svg" alt="BitácoraStudio" width={190} height={28} priority className="h-7 w-auto" />
        </Link>
        <div className="glass-card mb-5 rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-orange">
              <span className={`h-2 w-2 rounded-full ${startedAt ? "animate-pulse bg-emerald-400" : "bg-brand-orange"}`} />
              Cronómetro
            </span>
            <span className="font-mono text-lg font-bold">{formatElapsed(elapsed)}</span>
          </div>
          <select
            value={selectedProjectId}
            onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedTaskId(""); }}
            disabled={Boolean(startedAt)}
            className="glass-input mb-2 w-full rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Selecciona proyecto</option>
            {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
          <select
            value={selectedTaskId}
            onChange={(event) => setSelectedTaskId(event.target.value)}
            disabled={Boolean(startedAt) || !selectedProjectId}
            className="glass-input mb-3 w-full rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Sin tarea</option>
            {projectTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
          {startedAt ? (
            <button onClick={stopTimer} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-400 px-3 py-2.5 text-sm font-semibold text-slate-950">
              <Timer size={16} /> Detener registro
            </button>
          ) : (
            <button onClick={startTimer} disabled={!selectedProjectId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-3 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">
              <Timer size={16} /> Iniciar registro
            </button>
          )}
        </div>
        <nav className="hidden space-y-1.5 lg:block">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ${tab === id ? "border border-brand-orange/30 bg-brand-orange/15 font-medium text-brand-orange" : "text-slate-300 hover:bg-white/10"}`}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 pt-5 lg:block">
          <p className={`mb-3 text-xs ${online ? "text-emerald-300" : "text-amber-300"}`}>
            {online ? "Conectado" : "Sin conexión"} · {pending} pendientes
          </p>
          <button onClick={() => void flushSyncJobs().then(refresh)} className="mb-3 w-full rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10">
            Sincronizar ahora
          </button>
          <Link href="/login" className="block rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm hover:bg-white/10">Cuenta</Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 lg:p-8">
        {tab === "dashboard" && (
          <>
            <header className="mb-8 flex items-center justify-between gap-4">
              <div><h1 className="text-2xl font-bold sm:text-3xl">Dashboard operativo</h1><p className="mt-1 text-sm text-brand-gray">Datos locales y sincronización en la nube.</p></div>
              <span className={`rounded-full px-3 py-1 text-xs ${online ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>{online ? "Online" : "Offline"}</span>
            </header>
            <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {([
                ["Horas hoy", `${analytics.todayHours.toFixed(2)} h`, "Registros locales", Clock3],
                ["Esta semana", `${analytics.weekHours.toFixed(2)} h`, "Horas acumuladas", BarChart3],
                ["Proyectos activos", String(activeProjects.length), "En curso", BriefcaseBusiness],
                ["Tareas abiertas", String(tasks.filter((task) => !task.isCompleted).length), "Por completar", ListTodo],
              ] as [string, string, string, typeof Clock3][]).map(([label, value, detail, Icon]) => (
                <article key={String(label)} className="glass-panel rounded-2xl p-5">
                  <div className="flex items-start justify-between"><div><p className="text-xs uppercase text-brand-gray">{label}</p><p className="mt-2 font-mono text-3xl font-bold">{value}</p></div><span className="rounded-xl bg-brand-orange/15 p-2.5 text-brand-orange">{typeof Icon === "function" && <Icon size={20} />}</span></div>
                  <p className="mt-3 text-xs text-slate-400">{detail}</p>
                </article>
              ))}
            </section>
            <section className="glass-panel mt-6 rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><h2 className="font-semibold">Capacidad mensual</h2><p className="mt-1 text-xs text-brand-gray">{estimatedMonthlyHours.toFixed(1)} h planificadas de {settings.monthlyAvailableHours} h disponibles</p></div>
                <button onClick={() => setTab("analytics")} className="text-sm text-brand-orange hover:text-amber-300">Ver analítica</button>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${monthlyCapacityPercent >= 90 ? "bg-red-400" : "bg-brand-orange"}`} style={{ width: `${Math.min(monthlyCapacityPercent, 100)}%` }} /></div>
            </section>
            <article className="glass-panel mt-6 rounded-2xl p-5">
              <h2 className="font-semibold">Actividad reciente</h2>
              {timeLogs.length === 0 ? <p className="mt-5 text-sm text-brand-gray">Crea un proyecto y registra tus primeras horas.</p> : (
                <div className="mt-4 space-y-2">{timeLogs.slice(-8).reverse().map((log) => <div key={log.id} className="flex justify-between rounded-xl bg-white/[0.04] px-4 py-3 text-sm"><span>{projects.find((project) => project.id === log.projectId)?.title || "Proyecto"}</span><strong>{log.durationHours.toFixed(2)} h</strong></div>)}</div>
              )}
            </article>
          </>
        )}

        {tab === "projects" && (
          <>
            <header className="mb-6 flex items-center justify-between"><h1 className="text-2xl font-bold">Proyectos</h1><FolderPlus className="text-brand-orange" /></header>
            <div className="glass-panel mb-6 grid gap-3 rounded-2xl p-5 sm:grid-cols-[1fr_220px_auto]">
              <input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} placeholder="Nombre del proyecto" className="glass-input rounded-xl px-3 py-2.5" />
              <select value={newProjectCategory} onChange={(event) => setNewProjectCategory(event.target.value)} className="glass-input rounded-xl px-3 py-2.5">
                <option value="">Selecciona rubro</option>
                {Object.entries(categories).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <button onClick={addProject} disabled={!newProjectTitle.trim() || !newProjectCategory} className="rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"><Plus className="mr-1 inline" size={16} />Crear</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <article key={project.id} className="glass-panel rounded-2xl p-5">
                  <p className="text-xs text-brand-orange">{categories[project.categoryId] || "Sin rubro"}</p>
                  <h2 className="mt-2 font-semibold">{project.title}</h2>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => { setSelectedProjectId(project.id); setTab("tasks"); }} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10">Abrir tareas</button>
                    <button onClick={() => void updateProjectStatus(project)} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10">
                      {project.status === "active" ? "Pausar" : project.status === "paused" ? "Completar" : "Reactivar"}
                    </button>
                    <button onClick={() => void deleteProject(project.id)} className="rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-400/10">Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "tasks" && (
          <>
            <header className="mb-6"><h1 className="text-2xl font-bold">Tareas internas</h1></header>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="glass-input mb-5 w-full max-w-md rounded-xl px-3 py-2.5">
              <option value="">Selecciona proyecto</option>
              {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
            {selectedProjectId && (
              <>
                <div className="glass-panel mb-5 flex gap-3 rounded-2xl p-4">
                  <input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Nueva tarea" className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5" />
                  <button onClick={addTask} disabled={!newTaskTitle.trim()} className="rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">Agregar</button>
                </div>
                {suggestedEstimate !== null && <p className="mb-5 text-xs text-emerald-300">Referencia histórica para este rubro: {taskBenchmark?.averageHours.toFixed(2)} h · sugerencia con buffer: {suggestedEstimate.toFixed(2)} h</p>}
                <div className="mb-5 flex flex-wrap gap-2">
                  {templates.map((template) => <button key={template} onClick={() => void createTaskFromTemplate(template)} className="rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/10">+ {template}</button>)}
                </div>
                <div className="space-y-3">
                  {projectTasks.map((task) => (
                    <article key={task.id} className="glass-panel flex items-center gap-4 rounded-2xl p-4">
                      <input type="checkbox" checked={task.isCompleted} onChange={() => void toggleTask(task)} className="h-4 w-4 accent-orange-400" />
                      <div className="min-w-0 flex-1"><p className={task.isCompleted ? "text-brand-gray line-through" : "font-medium"}>{task.title}</p><p className="mt-1 text-xs text-brand-gray">{task.loggedHours.toFixed(2)} h registradas · Estimado {task.estimatedHours.toFixed(2)} h</p></div>
                      <button onClick={() => { setSelectedTaskId(task.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/10">Usar en cronómetro</button>
                      <button onClick={() => void deleteTask(task.id)} className="rounded-lg px-3 py-2 text-xs text-red-300 hover:bg-red-400/10">Eliminar</button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "catalog" && (
          <>
            <header className="mb-6"><h1 className="text-2xl font-bold">Catálogo</h1></header>
            <h2 className="mb-3 font-semibold">Rubros</h2>
            <div className="glass-panel mb-5 flex flex-wrap gap-3 rounded-2xl p-4">
              <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Nuevo rubro" className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5" />
              <input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} className="h-11 w-14 rounded-xl border border-white/15 bg-transparent p-1" aria-label="Color del rubro" />
              <button onClick={saveCategory} disabled={!newCategoryName.trim()} className="rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">Agregar</button>
            </div>
            <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryRows.map((category) => (
                <article key={category.id} className="glass-panel rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span>
                    <button onClick={() => void deleteCategory(category.id)} className="rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-400/10">Eliminar</button>
                  </div>
                  <label className="mt-3 block text-xs text-brand-gray">
                    Tarifa por hora (vacío usa la tarifa general)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rateDrafts[category.id] ?? ""}
                      onChange={(event) => setRateDrafts((rates) => ({ ...rates, [category.id]: event.target.value }))}
                      onBlur={(event) => void saveCategoryRate(category, event.target.value)}
                      className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                </article>
              ))}
            </div>
            <h2 className="mb-3 font-semibold">Plantillas de tareas</h2>
            <div className="glass-panel mb-5 flex gap-3 rounded-2xl p-4">
              <input value={newTemplateName} onChange={(event) => setNewTemplateName(event.target.value)} placeholder="Nombre de plantilla" className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5" />
              <button onClick={saveTemplate} disabled={!newTemplateName.trim()} className="rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">Guardar</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templateRows.map((template) => (
                <article key={template.id} className="glass-panel flex items-center justify-between rounded-2xl p-4">
                  <p className="font-medium">{template.name}</p>
                  <button onClick={() => void deleteTemplate(template.id)} className="rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-400/10">Eliminar</button>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "analytics" && (
          <>
            <header className="mb-6">
              <h1 className="text-2xl font-bold sm:text-3xl">Analítica y capacidad</h1>
              <p className="mt-1 text-sm text-brand-gray">Métricas calculadas con la bitácora almacenada localmente.</p>
            </header>
            <section className="grid gap-4 sm:grid-cols-3">
              {[
                ["Hoy", analytics.todayHours],
                ["Esta semana", analytics.weekHours],
                ["Acumulado", analytics.totalHours],
              ].map(([label, hours]) => (
                <article key={String(label)} className="glass-panel rounded-2xl p-5">
                  <p className="text-xs uppercase text-brand-gray">{label}</p>
                  <p className="mt-2 font-mono text-3xl font-bold">{Number(hours).toFixed(2)} h</p>
                </article>
              ))}
            </section>
            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <article className="glass-panel rounded-2xl p-5">
                <h2 className="mb-4 font-semibold">Horas por rubro</h2>
                {analytics.categoryBreakdown.length === 0 ? <p className="text-sm text-brand-gray">Aún no hay horas registradas.</p> : (
                  <div className="space-y-4">
                    {analytics.categoryBreakdown.map((item) => {
                      const maxHours = Math.max(...analytics.categoryBreakdown.map((row) => row.hours), 1);
                      return <div key={item.categoryId}>
                        <div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><span>{item.hours.toFixed(2)} h</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${(item.hours / maxHours) * 100}%`, backgroundColor: item.color }} /></div>
                      </div>;
                    })}
                  </div>
                )}
              </article>
              <article className="glass-panel rounded-2xl p-5">
                <h2 className="mb-4 font-semibold">Horas por proyecto</h2>
                {analytics.projectBreakdown.length === 0 ? <p className="text-sm text-brand-gray">Aún no hay horas registradas.</p> : (
                  <div className="space-y-4">
                    {analytics.projectBreakdown.map((item) => {
                      const maxHours = Math.max(...analytics.projectBreakdown.map((row) => row.hours), 1);
                      return <div key={item.projectId}>
                        <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{item.title}</span><span>{item.hours.toFixed(2)} h</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-orange" style={{ width: `${(item.hours / maxHours) * 100}%` }} /></div>
                      </div>;
                    })}
                  </div>
                )}
              </article>
            </section>
            <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
              <article className="glass-panel rounded-2xl p-5">
                <h2 className="mb-4 font-semibold">Parámetros personales</h2>
                <label className="mb-4 block text-sm">
                  Horas disponibles al mes
                  <input type="number" min="0" step="1" value={settings.monthlyAvailableHours} onChange={(event) => void saveSettings({ monthlyAvailableHours: Math.max(Number(event.target.value), 0) })} className="glass-input mt-1.5 w-full rounded-xl px-3 py-2.5" />
                </label>
                <label className="mb-4 block text-sm">
                  Buffer para sugerencias (%)
                  <input type="number" min="0" max="100" step="1" value={settings.estimateBufferPercent} onChange={(event) => void saveSettings({ estimateBufferPercent: Math.min(Math.max(Number(event.target.value), 0), 100) })} className="glass-input mt-1.5 w-full rounded-xl px-3 py-2.5" />
                </label>
                <label className="block text-sm">
                  Tarifa general por hora (USD)
                  <input type="number" min="0" step="0.01" value={settings.defaultHourlyRate} onChange={(event) => void saveSettings({ defaultHourlyRate: Math.max(Number(event.target.value), 0) })} className="glass-input mt-1.5 w-full rounded-xl px-3 py-2.5" />
                </label>
              </article>
              <article className="glass-panel rounded-2xl p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div><h2 className="font-semibold">Capacidad mensual</h2><p className="mt-1 text-xs text-brand-gray">Horas estimadas restantes en proyectos activos.</p></div>
                  <span className={`text-sm font-semibold ${monthlyCapacityPercent >= 90 ? "text-red-300" : "text-brand-orange"}`}>{monthlyCapacityPercent.toFixed(0)}%</span>
                </div>
                <div className="mb-4 h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${monthlyCapacityPercent >= 90 ? "bg-red-400" : "bg-brand-orange"}`} style={{ width: `${Math.min(monthlyCapacityPercent, 100)}%` }} /></div>
                <p className="mb-4 text-sm">{estimatedMonthlyHours.toFixed(2)} h de {settings.monthlyAvailableHours} h disponibles</p>
                <div className="space-y-2">
                  {monthlyLoad.length === 0 ? <p className="text-sm text-brand-gray">No hay proyectos activos.</p> : monthlyLoad.map((project) => (
                    <div key={project.projectId} className="flex justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm"><span className="truncate">{project.title}</span><span>{project.remainingHours.toFixed(2)} h</span></div>
                  ))}
                </div>
              </article>
            </section>
            <article className="glass-panel mt-5 rounded-2xl p-5">
              <h2 className="mb-1 font-semibold">Benchmarks históricos por título y rubro</h2>
              <p className="mb-4 text-xs text-brand-gray">Promedio de horas registradas en tareas anteriores; el buffer se aplica al crear la nueva tarea.</p>
              {analytics.benchmarks.length === 0 ? <p className="text-sm text-brand-gray">Completa tareas y registra horas para generar referencias.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="text-xs text-brand-gray"><tr><th className="pb-2">Tarea</th><th className="pb-2">Rubro</th><th className="pb-2">Muestras</th><th className="pb-2">Promedio</th></tr></thead>
                    <tbody>{analytics.benchmarks.map((benchmark) => (
                      <tr key={`${benchmark.categoryId}:${normalizeTaskTitle(benchmark.title)}`} className="border-t border-white/10">
                        <td className="py-2">{benchmark.title}</td>
                        <td className="py-2">{categories[benchmark.categoryId] ?? "Rubro"}</td>
                        <td className="py-2">{benchmark.samples}</td>
                        <td className="py-2">{benchmark.averageHours.toFixed(2)} h</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </article>
          </>
        )}

        {tab === "quote" && (
          <>
            <header className="mb-6">
              <h1 className="text-2xl font-bold sm:text-3xl">Simulador de cotización</h1>
              <p className="mt-1 text-sm text-brand-gray">Combina tareas, tarifa por rubro y buffer de estimación.</p>
            </header>
            <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
              <article className="glass-panel rounded-2xl p-5">
                <label className="mb-5 block text-sm">
                  Rubro para la cotización
                  <select value={quoteCategoryId} onChange={(event) => setQuoteCategoryId(event.target.value)} className="glass-input mt-1.5 w-full rounded-xl px-3 py-2.5">
                    <option value="">Selecciona rubro</option>
                    {categoryRows.filter((category) => !category.deletedAt).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                  <input value={quoteTaskTitle} onChange={(event) => setQuoteTaskTitle(event.target.value)} placeholder="Nombre de la tarea" className="glass-input rounded-xl px-3 py-2.5" />
                  <input type="number" min="0.01" step="0.25" value={quoteTaskHours} onChange={(event) => setQuoteTaskHours(event.target.value)} placeholder="Horas" className="glass-input rounded-xl px-3 py-2.5" />
                  <button onClick={addQuoteItem} disabled={!quoteTaskTitle.trim() || !(Number(quoteTaskHours) > 0)} className="rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50">Añadir tarea</button>
                </div>
                {quoteBenchmark && <button onClick={() => setQuoteTaskHours(quoteBenchmark.averageHours.toFixed(2))} className="mt-2 text-xs text-emerald-300 hover:text-emerald-200">Usar promedio histórico: {quoteBenchmark.averageHours.toFixed(2)} h ({quoteBenchmark.samples} muestras)</button>}
                <div className="mt-5 space-y-2">
                  {quoteItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-3 text-sm">
                      <span className="truncate">{item.title}</span><span>{item.hours.toFixed(2)} h</span>
                      <button onClick={() => setQuoteItems((items) => items.filter((row) => row.id !== item.id))} className="text-xs text-red-300">Quitar</button>
                    </div>
                  ))}
                  {quoteItems.length === 0 && <p className="text-sm text-brand-gray">Añade tareas con sus horas estimadas para calcular el precio.</p>}
                </div>
              </article>
              <article className="glass-panel rounded-2xl p-5">
                <h2 className="mb-4 font-semibold">Resumen estimado</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-brand-gray">Horas base</span><span>{quoteHours.toFixed(2)} h</span></div>
                  <div className="flex justify-between"><span className="text-brand-gray">Buffer</span><span>{settings.estimateBufferPercent}%</span></div>
                  <div className="flex justify-between"><span className="text-brand-gray">Horas cotizadas</span><span>{quoteEstimatedHours.toFixed(2)} h</span></div>
                  <div className="flex justify-between"><span className="text-brand-gray">Tarifa</span><span>${quoteRate.toFixed(2)} / h</span></div>
                </div>
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="text-xs uppercase text-brand-gray">Precio estimado (USD)</p>
                  <p className="mt-2 font-mono text-4xl font-bold text-brand-orange">{new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(quoteTotal)}</p>
                </div>
              </article>
            </section>
          </>
        )}
      </main>

      <nav className="glass-panel fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-white/10 px-1 py-2 lg:hidden">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-1 text-[9px] ${tab === id ? "text-brand-orange" : "text-slate-400"}`}><Icon size={17} /><span>{label}</span></button>
        ))}
      </nav>
    </div>
  );
}
