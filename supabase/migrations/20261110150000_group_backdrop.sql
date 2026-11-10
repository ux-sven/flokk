-- Bakgrunnsbilde for flokken, som alternativ til ensfarget flate.
-- null = bruk fargen i «tint». Bildene ligger i public/backdrops/<navn>.svg.
-- Admins kan endre bakgrunn via eksisterende policy «groups_update_admin».
-- Skrevet slik at den kan kjøres på nytt (også om en tidligere versjon er kjørt).
alter table public.groups add column if not exists backdrop text;

-- Verdier som ikke lenger finnes (fra en tidligere versjon) nullstilles
update public.groups set backdrop = null
where backdrop is not null and backdrop not in ('var', 'sommer', 'host', 'vinter', 'fotball', 'ski', 'sykkel', 'noter', 'piano', 'lydbolger', 'kaffe', 'sitrus', 'urter', 'friluftsliv', 'boker', 'reise');

alter table public.groups drop constraint if exists groups_backdrop_check;
alter table public.groups add constraint groups_backdrop_check
  check (backdrop in ('var', 'sommer', 'host', 'vinter', 'fotball', 'ski', 'sykkel', 'noter', 'piano', 'lydbolger', 'kaffe', 'sitrus', 'urter', 'friluftsliv', 'boker', 'reise'));
