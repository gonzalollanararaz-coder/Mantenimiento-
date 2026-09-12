-- ═══════════════════════════════════════════════════════════════════
--  Tablas nuevas para SOS: Plan de Muestreo y Stock de Frascos.
--  "Obra" en ambas usa el mismo cod_proyec que ya usa Maestro de
--  Equipos (P-0171, P-0175, etc.) — no hace falta una tabla de mapeo
--  aparte, sos_planilla.obra ya se llena con ese mismo valor.
--  Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Plan de Muestreo — frecuencia por Tipo de Equipo + Sistema
create table if not exists public.sos_plan_muestreo (
  id bigint generated always as identity primary key,
  tipo_equipo text not null,   -- debe coincidir con maestro.familia
  sistema text not null,
  frecuencia numeric not null, -- en HR o KM, según el contador del equipo
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Parámetros de precisión (una sola fila, igual que en la hoja PLAN_MUESTREO)
create table if not exists public.sos_parametros (
  id int primary key default 1,
  meta_cumplimiento numeric default 0.7,      -- 70%
  umbral_critico numeric default 0.5,         -- 50%
  tolerancia_horometro_pct numeric default 0.1,  -- ±10%
  tolerancia_fecha_dias int default 3,        -- ±3 días
  constraint solo_una_fila check (id = 1)
);
insert into public.sos_parametros (id) values (1) on conflict (id) do nothing;

-- 2) Stock de Frascos — un código por frasco físico, por obra
create table if not exists public.sos_stock (
  id bigint generated always as identity primary key,
  cod_proyec text not null,     -- coincide con maestro.cod_proyec y sos_planilla.obra
  codigo text not null unique,  -- ej: HUA175-000001
  fecha_ingreso date default current_date,
  created_at timestamptz default now()
);

-- Índices para que los cálculos (disponibles/usados, cruces con Planilla) sean rápidos
create index if not exists idx_sos_stock_proyec on public.sos_stock(cod_proyec);
create index if not exists idx_sos_planilla_frasco on public.sos_planilla(frasco);

-- Permisos: mismo criterio que las demás tablas de SOS (ajusta si tu proyecto
-- ya maneja esto distinto — revisa cómo quedaron las políticas de sos_planilla
-- y replica el mismo patrón aquí si esto no aplica tal cual).
alter table public.sos_plan_muestreo enable row level security;
alter table public.sos_parametros enable row level security;
alter table public.sos_stock enable row level security;

create policy "leer_plan_muestreo" on public.sos_plan_muestreo for select using (true);
create policy "leer_parametros" on public.sos_parametros for select using (true);
create policy "leer_stock" on public.sos_stock for select using (true);

create policy "escribir_plan_muestreo" on public.sos_plan_muestreo for all using (auth.role() = 'authenticated');
create policy "escribir_parametros" on public.sos_parametros for all using (auth.role() = 'authenticated');
create policy "escribir_stock" on public.sos_stock for all using (auth.role() = 'authenticated');

