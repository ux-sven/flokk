-- Koordinater for arrangementets sted. Settes når brukeren velger en adresse eller et
-- stedsnavn fra søket (Kartverket). «location» er fortsatt fritekst som vises; uten
-- koordinater er stedet bare tekst («Hos Kari»).
alter table public.events
  add column location_lat double precision,
  add column location_lng double precision,
  add constraint events_location_coords_chk check (
    (location_lat is null and location_lng is null)
    or (location_lat between -90 and 90 and location_lng between -180 and 180)
  );
