# BitácoraStudio

Base de BitácoraStudio en Next.js 15, con UI en español, tema Glassmorfismo y autenticación preparada para Supabase Email/Password y Google.

## Estructura

- `app/`: rutas App Router, estilos globales y callback OAuth.
- `components/auth/`: formulario de acceso y registro.
- `lib/supabase/`: clientes de Supabase.
- `supabase/migrations/`: esquema Postgres, RLS y triggers.
- `public/images/`: logos e imágenes de marca.
- `prototype/`: prototipo HTML de referencia.
- `design/`: archivo fuente de diseño.

## Desarrollo local

1. Instala dependencias con `npm install`.
2. Copia `.env.example` a `.env.local` y define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Ejecuta la migración en el SQL Editor de Supabase o con Supabase CLI.
4. En Supabase Auth, habilita Email y Google, configura las credenciales OAuth de Google y agrega `http://localhost:3000/auth/callback` a las URLs de redirección permitidas.
5. Inicia el sitio con `npm run dev`.

El trigger de registro crea el perfil Free y un conjunto inicial de rubros. El acceso a los datos del usuario se limita mediante RLS; la migración también impide que el cliente autenticado modifique directamente el nivel de plan o el estado de pago.
