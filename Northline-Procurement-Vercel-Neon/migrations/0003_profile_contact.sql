-- Expand contractor/company profiles for verification
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists email text not null default '';
alter table profiles add column if not exists address text not null default '';
