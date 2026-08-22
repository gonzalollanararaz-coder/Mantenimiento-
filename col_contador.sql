-- ═══════════════════════════════════════════════════════════════════
--  Columna "Contador": indica si el equipo mide en horas o kilómetros.
--  Se usa para calcular HR/día y el rendimiento de combustible.
--  Ejecutar en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════

alter table public.maestro add column if not exists contador text;

-- Carga inicial orientativa: los vehículos suelen medirse en kilómetros
-- y la maquinaria en horas. Revísalo después equipo por equipo en la app.
update public.maestro
set contador = case
      when familia ilike '%VEH%' then 'Km'
      when marca   ilike '%TOYOTA%' or marca ilike '%HINO%'
        or marca   ilike '%MERCEDES%' or marca ilike '%SCANIA%'
        or marca   ilike '%VOLVO%'  or marca ilike '%FAW%'   then 'Km'
      else 'Hr'
    end
where contador is null;

-- Cómo quedó
select coalesce(contador,'(vacío)') as contador, count(*) as equipos
from public.maestro group by 1 order by 2 desc;

-- Detalle por familia, para revisar los casos dudosos
select familia, contador, count(*) as equipos
from public.maestro group by 1,2 order by 1,2;
