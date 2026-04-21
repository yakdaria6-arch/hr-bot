-- HR Bot — Supabase schema
-- Run this in the Supabase SQL Editor

-- ─────────────────────────────────────────────
--  VACANCIES
-- ─────────────────────────────────────────────
create table if not exists vacancies (
  id                uuid primary key default gen_random_uuid(),
  company_name      text not null,
  title             text not null,
  description       text default '',
  salary            text default '',
  schedule          text default '',
  format            text default '',
  pass_score        int  not null default 60,   -- 0-100, min score to pass
  questions         jsonb not null default '[]', -- Question[]
  is_active         boolean not null default true,
  telegram_chat_id  text default '',             -- override per-vacancy
  created_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
--  CANDIDATES
-- ─────────────────────────────────────────────
create table if not exists candidates (
  id             uuid primary key default gen_random_uuid(),
  vacancy_id     uuid references vacancies(id) on delete set null,
  vacancy_title  text default '',
  name           text default '',
  email          text default '',
  phone          text default '',
  answers        jsonb not null default '[]',   -- Answer[]
  total_score    int  not null default 0,       -- 0-100
  category       text not null default 'red',   -- 'green'|'yellow'|'red'
  status         text not null default 'new',   -- CandidateStatus
  notes          text default '',
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────
--  ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────
-- Public (anon) can read active vacancies and insert candidates
alter table vacancies  enable row level security;
alter table candidates enable row level security;

-- Anyone can view active vacancies (for apply page)
create policy "public read active vacancies"
  on vacancies for select
  using (is_active = true);

-- Anyone can submit a candidate (apply form)
create policy "public insert candidates"
  on candidates for insert
  with check (true);

-- Service role (admin via API key) can do everything
-- This is handled automatically by supabase service_role key.
-- If you use anon key in admin panel, add these policies:

create policy "anon read vacancies"
  on vacancies for select
  using (true);

create policy "anon manage vacancies"
  on vacancies for all
  using (true)
  with check (true);

create policy "anon read candidates"
  on candidates for select
  using (true);

create policy "anon update candidates"
  on candidates for update
  using (true)
  with check (true);

-- ─────────────────────────────────────────────
--  AUDIT ORDERS
-- ─────────────────────────────────────────────
create table if not exists audit_orders (
  id            uuid primary key default gen_random_uuid(),
  url           text not null,
  platform      text not null,       -- 'ozon' | 'wb'
  contact       text not null,       -- email or telegram
  notes         text default '',
  screenshots   jsonb not null default '[]',  -- array of storage paths
  status        text not null default 'new',  -- 'new'|'processing'|'done'
  pdf_url       text default '',
  created_at    timestamptz not null default now()
);

alter table audit_orders enable row level security;

-- Anyone can submit an order
create policy "public insert audit_orders"
  on audit_orders for insert
  with check (true);

-- Admin (anon key) can read and update
create policy "anon read audit_orders"
  on audit_orders for select
  using (true);

create policy "anon update audit_orders"
  on audit_orders for update
  using (true)
  with check (true);

-- Storage bucket: audit-screenshots
-- Create this manually in Supabase Dashboard → Storage → New bucket
-- Name: audit-screenshots, Public: true

-- ─────────────────────────────────────────────
--  SAMPLE VACANCY (optional, for testing)
-- ─────────────────────────────────────────────
/*
insert into vacancies (company_name, title, description, salary, schedule, format, pass_score, questions) values (
  'Demo Corp',
  'Менеджер по продажам',
  'Работа с входящим потоком клиентов, ведение CRM',
  'от 60 000 ₽ + %',
  '5/2, 9-18',
  'Офис',
  60,
  '[
    {"id":"q1","text":"Опишите ваш опыт в продажах: сколько лет, какие продукты?","weight":5,"good_keywords":["опыт","продажи","клиенты","выполнение плана"],"bad_keywords":["нет опыта","впервые"],"required":true},
    {"id":"q2","text":"Как вы работаете с возражениями клиента?","weight":4,"good_keywords":["выслушиваю","понимаю","аргументы","решение"],"bad_keywords":["не знаю","сложно"],"required":true},
    {"id":"q3","text":"Какой ваш желаемый доход?","weight":2,"good_keywords":[],"bad_keywords":[],"required":false}
  ]'
);
*/
