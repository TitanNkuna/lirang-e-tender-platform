-- Northline procurement schema
create table if not exists profiles (
  user_id text primary key,
  role text not null check (role in ('procurement', 'contractor')),
  company_name text not null,
  contact_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists templates (
  id serial primary key,
  owner_id text not null,
  name text not null,
  description text not null default '',
  category text not null default 'General',
  schema_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists templates_owner_id_idx on templates (owner_id);

create table if not exists tenders (
  id serial primary key,
  owner_id text not null,
  template_id int,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  due_at timestamptz,
  visibility text not null default 'open' check (visibility in ('open', 'invite_only')),
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'awarded')),
  schema_json text not null,
  awarded_submission_id int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tenders_owner_id_idx on tenders (owner_id);
create index if not exists tenders_status_idx on tenders (status);

create table if not exists tender_invites (
  id serial primary key,
  tender_id int not null references tenders(id) on delete cascade,
  contractor_user_id text not null,
  created_at timestamptz not null default now(),
  unique (tender_id, contractor_user_id)
);
create index if not exists tender_invites_contractor_idx on tender_invites (contractor_user_id);

create table if not exists submissions (
  id serial primary key,
  tender_id int not null references tenders(id) on delete cascade,
  contractor_user_id text not null,
  company_name text not null,
  payload_json text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'rejected', 'shortlisted', 'awarded')),
  is_sample boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tender_id, contractor_user_id)
);
create index if not exists submissions_tender_id_idx on submissions (tender_id);
create index if not exists submissions_contractor_idx on submissions (contractor_user_id);

create table if not exists ai_reviews (
  id serial primary key,
  tender_id int not null references tenders(id) on delete cascade,
  requested_by text not null,
  result_json text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_reviews_tender_id_idx on ai_reviews (tender_id);
