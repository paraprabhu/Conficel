-- Extend one-use extraction permits to the existing quotation and other-document workflows.
alter table public.extraction_permits
  drop constraint if exists extraction_permits_mode_check;
alter table public.extraction_permits
  add constraint extraction_permits_mode_check
  check (mode in ('invoice','cheque','quotation','other'));
