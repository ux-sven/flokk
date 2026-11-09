-- /konto/* brukes til registrering og passord – reserver adressen
alter table public.groups
  add constraint groups_slug_not_reserved_account
  check (slug not in ('konto', 'registrer', 'passord'));
