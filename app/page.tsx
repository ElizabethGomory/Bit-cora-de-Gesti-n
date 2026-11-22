import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  FolderPlus,
  LayoutDashboard,
  ListTodo,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";

const navigation = [
  { label: "Dashboard & tiempos", icon: LayoutDashboard, active: true },
  { label: "Lista de proyectos", icon: BriefcaseBusiness, active: false },
  { label: "Bitácora diaria", icon: Clock3, active: false },
  { label: "Planificador", icon: CalendarDays, active: false },
  { label: "Catálogo", icon: ListTodo, active: false },
];

const metrics = [
  { label: "Horas hoy", value: "0.0 h", detail: "Sin sesiones registradas", icon: Clock3 },
  { label: "Esta semana", value: "0.0 h", detail: "Meta semanal: 40 h", icon: CalendarDays },
  { label: "Proyectos activos", value: "0", detail: "En curso", icon: BriefcaseBusiness },
  { label: "Ingresos estimados", value: "$0", detail: "Según tus horas registradas", icon: BarChart3 },
];

export default function Home() {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="glass-panel z-10 flex w-full flex-col border-b border-white/10 p-5 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <Link href="/" className="mb-8 inline-flex items-center" aria-label="BitácoraStudio inicio">
          <Image
            src="/images/logo.svg"
            alt=""
            width={40}
            height={40}
            priority
            className="mr-2 h-10 w-10"
          />
          <Image
            src="/images/isotipo.svg"
            alt="BitácoraStudio"
            width={190}
            height={28}
            priority
            className="h-7 w-auto"
          />
        </Link>

        <div className="glass-card mb-6 rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-orange">
              <span className="h-2 w-2 rounded-full bg-brand-orange" />
              Cronómetro Focus
            </span>
            <span className="font-mono text-lg font-bold">00:00:00</span>
          </div>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-3 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400">
            <Timer size={16} />
            Iniciar registro
          </button>
          <p className="mt-2 text-center text-xs text-brand-gray">Elige un proyecto para comenzar</p>
        </div>

        <nav aria-label="Navegación principal" className="hidden space-y-1.5 lg:block">
          {navigation.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                active
                  ? "border border-brand-orange/30 bg-brand-orange/15 font-medium text-brand-orange"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 pt-5 lg:block">
          <p className="mb-3 text-xs text-brand-gray">¿Quieres sincronización en la nube?</p>
          <Link
            href="/login"
            className="block rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm text-white transition hover:bg-white/10"
          >
            Iniciar sesión
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 lg:p-8">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard analítico</h1>
            <p className="mt-1 text-sm text-brand-gray">
              Tus métricas de tiempo, proyectos y capacidad mensual.
            </p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-brand-orange/15 transition hover:bg-amber-400">
            <FolderPlus size={17} />
            Nuevo proyecto
          </button>
        </header>

        <section aria-label="Resumen de actividad" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {metrics.map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className="glass-panel rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-gray">{label}</p>
                  <p className="mt-2 font-mono text-3xl font-bold">{value}</p>
                </div>
                <span className="rounded-xl bg-brand-orange/15 p-2.5 text-brand-orange">
                  <Icon size={20} />
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-400">{detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-5">
          <article className="glass-panel rounded-2xl p-5 xl:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Actividad reciente</h2>
                <p className="mt-1 text-sm text-brand-gray">Tus horas registradas aparecerán aquí.</p>
              </div>
              <BarChart3 className="text-brand-orange" size={20} />
            </div>
            <div className="mt-6 flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 text-center">
              <Sparkles className="mb-3 text-brand-orange" size={28} />
              <p className="text-sm font-medium">Tu bitácora comienza aquí</p>
              <p className="mt-1 max-w-sm text-xs text-brand-gray">
                Crea un proyecto y registra tus primeras horas para ver tus métricas.
              </p>
            </div>
          </article>

          <article className="glass-panel rounded-2xl p-5 xl:col-span-2">
            <h2 className="font-semibold">Proyectos</h2>
            <p className="mt-1 text-sm text-brand-gray">Resumen de tu trabajo activo.</p>
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-sm text-slate-300">Aún no tienes proyectos</p>
              <button className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-orange transition hover:bg-brand-orange/10">
                <Plus size={16} />
                Crear proyecto
              </button>
            </div>
          </article>
        </section>
      </main>

      <nav
        aria-label="Navegación móvil"
        className="glass-panel fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-white/10 px-2 py-2 lg:hidden"
      >
        {navigation.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            className={`flex flex-col items-center gap-1 px-1 py-1 text-[10px] ${
              active ? "text-brand-orange" : "text-slate-400"
            }`}
          >
            <Icon size={18} />
            <span className="max-w-full truncate">{label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
