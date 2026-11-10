-- Egen bakgrunn for arrangementer. null = bruk flokkens utseende.
-- Samme verdier som groups.backdrop (bildene i public/backdrops/<navn>.svg).
-- Arrangøren eller en admin kan endre den via eksisterende policy «events_update».
alter table public.events add column if not exists backdrop text;

alter table public.events drop constraint if exists events_backdrop_check;
alter table public.events add constraint events_backdrop_check
  check (backdrop in ('var', 'sommer', 'host', 'vinter', 'fotball', 'ski', 'sykkel', 'noter', 'piano', 'lydbolger', 'kaffe', 'sitrus', 'urter', 'friluftsliv', 'boker', 'reise'));

-- Rettelse av migrasjon 9: koordinatene må settes sammen (begge eller ingen).
-- Den forrige sjekken slapp gjennom breddegrad uten lengdegrad.
alter table public.events drop constraint if exists events_location_coords_chk;
alter table public.events add constraint events_location_coords_chk check (
  (location_lat is null) = (location_lng is null)
  and (location_lat is null or location_lat between -90 and 90)
  and (location_lng is null or location_lng between -180 and 180)
);
