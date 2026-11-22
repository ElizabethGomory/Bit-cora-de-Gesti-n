"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();
      const result =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });

      if (result.error) throw result.error;
      if (mode === "sign-up" && !result.data.session) {
        setMessage("Revisa tu correo para confirmar la cuenta.");
      } else {
        window.location.assign("/");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo completar la autenticación.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) throw authError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo iniciar sesión con Google.");
      setLoading(false);
    }
  }

  return (
    <section className="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-8">
      <Link href="/" className="mb-7 flex justify-center">
        <Image src="/images/logo.svg" alt="" width={36} height={36} className="mr-2 h-9 w-9" />
        <Image src="/images/isotipo.svg" alt="BitácoraStudio" width={190} height={28} className="h-7 w-auto" />
      </Link>
      <h1 className="text-center text-2xl font-bold">
        {mode === "sign-in" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
      </h1>
      <p className="mt-2 text-center text-sm text-brand-gray">
        Accede a tu espacio de proyectos y bitácora.
      </p>

      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={loading}
        className="mt-7 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-60"
      >
        Continuar con Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-brand-gray">
        <span className="h-px flex-1 bg-white/10" />
        o con correo electrónico
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleEmailAuth} className="space-y-4">
        <label className="block text-sm">
          Correo electrónico
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="glass-input mt-1.5 w-full rounded-xl px-3 py-2.5"
          />
        </label>
        <label className="block text-sm">
          Contraseña
          <input
            required
            minLength={8}
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="glass-input mt-1.5 w-full rounded-xl px-3 py-2.5"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-brand-orange px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {loading ? "Procesando..." : mode === "sign-in" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-brand-gray">
        {mode === "sign-in" ? "¿Primera vez aquí?" : "¿Ya tienes una cuenta?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError("");
            setMessage("");
          }}
          className="font-medium text-brand-orange hover:text-amber-300"
        >
          {mode === "sign-in" ? "Crear cuenta" : "Inicia sesión"}
        </button>
      </p>
    </section>
  );
}
