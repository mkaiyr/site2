-- ============================================================
-- Concord / Kablan — схема базы данных для Supabase
-- Выполните этот файл целиком в Supabase Dashboard → SQL Editor.
-- Можно запускать повторно — все операции идемпотентны.
-- ============================================================

-- расширение для gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Столовые
-- ------------------------------------------------------------
create table if not exists cafeterias (
  id   text primary key,      -- короткий slug, напр. 'concord', 'kablan'
  name text not null          -- отображаемое имя
);

insert into cafeterias (id, name) values
  ('concord', 'Concord'),
  ('kablan',  'Kablan')
on conflict (id) do nothing;

-- Чтобы добавить новую столовую позже — просто:
--   insert into cafeterias (id, name) values ('newid', 'Название');
-- Переключатель на сайте подхватит её автоматически, без правок кода.

-- ------------------------------------------------------------
-- 2. Позиции меню
--    столовая + дата + категория(приём пищи) + блюдо
-- ------------------------------------------------------------
create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  cafeteria_id text not null references cafeterias(id) on delete cascade,
  date         date not null,
  category     text not null,          -- напр. "Первое", "Второе", "Салат", "Напиток"
                                        -- (это и есть meal_type — назовите категории как удобно,
                                        --  в т.ч. "Завтрак"/"Обед"/"Ужин", если так лучше для вашей столовой)
  name         text not null,
  description  text,
  weight       text,                   -- напр. "300" (граммы) или произвольный текст
  price        numeric,
  featured     boolean not null default false,  -- "блюдо дня"
  combo        boolean not null default false,  -- входит в комплексный обед
  hidden       boolean not null default false,  -- скрыть блюдо, не удаляя
  sort_order   int     not null default 0,      -- порядок отображения
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists menu_items_lookup_idx
  on menu_items (cafeteria_id, date);

-- ------------------------------------------------------------
-- 3. Статус дня (скрыть весь день целиком + время последнего обновления)
-- ------------------------------------------------------------
create table if not exists menu_day_status (
  cafeteria_id text not null references cafeterias(id) on delete cascade,
  date         date not null,
  hidden       boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (cafeteria_id, date)
);

-- ------------------------------------------------------------
-- 4. Список администраторов (кто из auth.users имеет права на запись)
-- ------------------------------------------------------------
create table if not exists admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  full_name text
);

-- После создания каждого администратора в Authentication → Users
-- добавьте его сюда командой (см. SETUP.md):
--   insert into admins (user_id, full_name) values ('<uuid-пользователя>', 'Имя Фамилия');
-- ------------------------------------------------------------
-- 5. Автообновление updated_at
-- ------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists menu_items_set_updated_at on menu_items;
create trigger menu_items_set_updated_at
  before update on menu_items
  for each row execute function set_updated_at();

drop trigger if exists menu_day_status_set_updated_at on menu_day_status;
create trigger menu_day_status_set_updated_at
  before update on menu_day_status
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 6. Вспомогательная функция: является ли текущий пользователь админом
--    (security definer — чтобы политики на menu_items не зависели
--     от отдельного разрешения на чтение таблицы admins)
-- ------------------------------------------------------------
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$ language sql stable security definer;

-- ------------------------------------------------------------
-- 7. Row Level Security
-- ------------------------------------------------------------
alter table cafeterias      enable row level security;
alter table menu_items      enable row level security;
alter table menu_day_status enable row level security;
alter table admins          enable row level security;

-- cafeterias: читать может любой (в т.ч. анонимный посетитель сайта)
drop policy if exists cafeterias_read_all on cafeterias;
create policy cafeterias_read_all on cafeterias
  for select using (true);

-- admins: пользователь может прочитать только свою собственную запись
drop policy if exists admins_read_self on admins;
create policy admins_read_self on admins
  for select using (auth.uid() = user_id);

-- menu_items: обычный посетитель видит только не скрытые блюда;
--             администратор видит вообще всё (включая скрытые)
drop policy if exists menu_items_public_read on menu_items;
create policy menu_items_public_read on menu_items
  for select using ( hidden = false or is_admin() );

drop policy if exists menu_items_admin_insert on menu_items;
create policy menu_items_admin_insert on menu_items
  for insert with check ( is_admin() );

drop policy if exists menu_items_admin_update on menu_items;
create policy menu_items_admin_update on menu_items
  for update using ( is_admin() ) with check ( is_admin() );

drop policy if exists menu_items_admin_delete on menu_items;
create policy menu_items_admin_delete on menu_items
  for delete using ( is_admin() );

-- menu_day_status: статус дня должен быть виден посетителю всегда,
-- иначе сайт не узнает, что весь день скрыт.
drop policy if exists menu_day_status_public_read on menu_day_status;
create policy menu_day_status_public_read on menu_day_status
  for select using ( true );

drop policy if exists menu_day_status_admin_insert on menu_day_status;
create policy menu_day_status_admin_insert on menu_day_status
  for insert with check ( is_admin() );

drop policy if exists menu_day_status_admin_update on menu_day_status;
create policy menu_day_status_admin_update on menu_day_status
  for update using ( is_admin() ) with check ( is_admin() );

drop policy if exists menu_day_status_admin_delete on menu_day_status;
create policy menu_day_status_admin_delete on menu_day_status
  for delete using ( is_admin() );

-- ------------------------------------------------------------
-- 8. (Необязательно) демонстрационное меню на сегодня,
--    чтобы сразу увидеть, что всё работает.
--    Для каждой столовой вставляется только при отсутствии её меню
--    на сегодня (файл можно запускать повторно).
-- ------------------------------------------------------------
insert into menu_items (cafeteria_id, date, category, name, weight, price, featured, combo, sort_order)
select * from (values
  ('concord', current_date, 'Первое',  'Суп',    '300', 450::numeric, true,  true, 1),
  ('concord', current_date, 'Второе',  'Плов',   '300', 700::numeric, false, true, 2),
  ('concord', current_date, 'Салат',   'Салат',  '150', 350::numeric, false, true, 3),
  ('concord', current_date, 'Напиток', 'Компот', '250', 200::numeric, false, true, 4),
  ('kablan',  current_date, 'Первое',  'Борщ',    '300', 480::numeric, true,  true, 1),
  ('kablan',  current_date, 'Второе',  'Котлета', '250', 650::numeric, false, true, 2),
  ('kablan',  current_date, 'Гарнир',  'Пюре',    '200', 300::numeric, false, true, 3),
  ('kablan',  current_date, 'Напиток', 'Чай',     '250', 150::numeric, false, true, 4)
) as seed(cafeteria_id, date, category, name, weight, price, featured, combo, sort_order)
where not exists (
  select 1
  from menu_items existing
  where existing.cafeteria_id = seed.cafeteria_id
    and existing.date = seed.date
);
