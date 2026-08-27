-- Company logo (data URL or https URL)
alter table profiles add column if not exists logo_url text not null default '';
