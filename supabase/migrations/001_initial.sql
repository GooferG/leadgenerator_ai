-- Users table
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  image text,
  approved boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Leads table
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  website text,
  score text check (score in ('hot', 'warm', 'cold')),
  score_label text,
  reasoning text,
  pitch text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted')),
  notes text,
  maps_url text,
  created_at timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists users_email_idx on users(email);
