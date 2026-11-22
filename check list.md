# BitácoraStudio — lista de verificación

## Estado general

- **Fase 1 — Base del proyecto:** En curso. La migración se aplicó en Supabase y se verificaron las seis tablas, RLS en todas, siete políticas y ocho triggers. Falta validar un registro de extremo a extremo y confirmar la configuración de Auth.
- **Fase 2 — Operación y modo offline:** Pendiente.
- **Fase 3 — Analítica y capacidad:** Pendiente; existe una maqueta visual del dashboard, pero todavía no calcula métricas reales.
- **Fase 4 — PWA y monetización:** Pendiente.

## Fase 1 — Estructura, diseño, Supabase y autenticación

- [x] Crear la aplicación base con Next.js App Router y TypeScript.
- [x] Organizar rutas, componentes de autenticación, utilidades de Supabase, imágenes y migraciones.
- [x] Implementar la base visual responsive con tema Slate y acentos naranjas.
- [x] Incorporar los recursos de marca en `public/images/`.
- [x] Preparar clientes de Supabase, páginas de acceso/registro y callback de autenticación.
- [x] Escribir la migración inicial con tablas, restricciones, RLS, políticas y triggers.
- [x] Aplicar `supabase/migrations/20261122000000_initial_schema.sql` en el proyecto Supabase.
- [x] Verificar las seis tablas, RLS, políticas y triggers después de aplicar la migración.
- [ ] Confirmar un registro de prueba y la creación automática del perfil Free y sus rubros iniciales.
- [ ] Habilitar y configurar Email y Google en Supabase Auth, incluidas las URLs de redirección locales y de producción.

## Fase 2 — CRUD, cronómetro y arquitectura offline-first

- [ ] Incorporar IndexedDB/Dexie y definir el modelo de datos local.
- [ ] Implementar la cola de sincronización y el indicador de estado online/offline.
- [ ] Crear CRUD de proyectos, tareas internas, rubros y plantillas de tareas.
- [ ] Implementar el cronómetro vinculado a proyecto y filtrar tareas por proyecto.
- [ ] Permitir crear tareas desde el cronómetro.
- [ ] Aplicar la autoestimación de tareas al registrar horas o completarlas.
- [ ] Probar sincronización, reintentos y conflictos al recuperar conexión.

## Fase 3 — Dashboard analítico y capacidad

- [ ] Calcular horas de hoy, de la semana y acumuladas por proyecto desde datos reales.
- [ ] Añadir visualizaciones por rubro y proyecto.
- [ ] Implementar benchmarks históricos cruzando título de tarea y rubro.
- [ ] Incorporar el buffer configurable para sugerencias de estimación.
- [ ] Calcular capacidad mensual según horas disponibles y carga de proyectos activos.
- [ ] Crear el simulador de cotización por rubro y conjunto de tareas.
- [ ] Validar métricas y cálculos con registros de prueba.

## Fase 4 — PWA, límites de plan y pagos web

- [ ] Añadir manifiesto, iconos instalables y service worker.
- [ ] Implementar y probar el flujo de instalación en escritorio y móvil.
- [ ] Crear `useSubscription()` y el componente `FeatureGate`.
- [ ] Aplicar límites Free/Pro en la interfaz y validar permisos del lado servidor.
- [ ] Añadir exportaciones PDF y backup JSON; habilitar CSV/Excel para Pro.
- [ ] Implementar checkout web para el proveedor de pagos elegido.
- [ ] Crear y proteger el webhook que actualiza el plan en Supabase.
- [ ] Probar actualización y cancelación de suscripciones de extremo a extremo.

## Criterio para empezar pruebas de registro

La base de datos ya está lista para una prueba de registro: la migración se aplicó correctamente y se verificaron las tablas, las políticas RLS y los triggers. Antes de probar, confirmar en Supabase Auth que Email esté habilitado y que la URL de redirección de la aplicación esté permitida. La creación del perfil Free y de los rubros iniciales se validará con el primer registro; no se creó ninguna cuenta de prueba durante la migración.
