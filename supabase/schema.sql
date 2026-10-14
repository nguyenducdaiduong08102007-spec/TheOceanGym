create table if not exists public.registrations (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 2 and 100),
    phone text not null check (phone ~ '^(?:\+84|0)(?:3|5|7|8|9)[0-9]{8}$'),
    goal text not null default '' check (char_length(goal) <= 120),
    submitted_at timestamptz not null default now()
);

create table if not exists public.revenue (
    id uuid primary key default gen_random_uuid(),
    amount bigint not null check (amount between 1 and 1000000000),
    created_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
    rate_key text primary key,
    window_started_at timestamptz not null,
    attempts integer not null check (attempts >= 1)
);

create table if not exists public.members (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text not null,
    plan text not null default 'Gói Cơ Bản',
    username text not null unique,
    password text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.coaches (
    id text primary key,
    name text not null,
    role text not null,
    bio text not null default '',
    experience text not null default '',
    certificates text not null default '',
    image_url text not null default '',
    phone text not null default '',
    email text not null default '',
    password text not null default 'coach123',
    status text not null default 'active',
    created_at timestamptz not null default now()
);

create table if not exists public.coach_applications (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text not null,
    email text not null default '',
    role_applied text not null,
    experience text not null,
    certificates text not null default '',
    image_url text not null default '',
    intro text not null default '',
    status text not null default 'pending',
    applied_at timestamptz not null default now()
);

create table if not exists public.bookings (
    id uuid primary key default gen_random_uuid(),
    member_name text not null,
    member_phone text not null,
    coach_id text not null,
    coach_name text not null,
    booking_date date not null,
    time_slot text not null,
    note text not null default '',
    status text not null default 'confirmed',
    created_at timestamptz not null default now()
);

create table if not exists public.reviews (
    id uuid primary key default gen_random_uuid(),
    user_name text not null,
    rating integer not null check (rating between 1 and 5),
    target_type text not null default 'gym',
    target_name text not null default 'Phòng Gym The Ocean',
    comment text not null,
    image_url text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
    id uuid primary key default gen_random_uuid(),
    author_name text not null,
    author_role text not null default 'member',
    content text not null,
    image_url text not null default '',
    likes integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    sender_name text not null,
    sender_role text not null default 'member',
    target_id text not null default 'all',
    content text not null,
    sent_at timestamptz not null default now()
);

alter table public.registrations enable row level security;
alter table public.revenue enable row level security;
alter table public.rate_limits enable row level security;
alter table public.members enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_applications enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.community_posts enable row level security;
alter table public.messages enable row level security;

revoke all on public.registrations, public.revenue, public.rate_limits, public.members, public.coaches, public.coach_applications, public.bookings, public.reviews, public.community_posts, public.messages from anon, authenticated;
grant select, insert on public.registrations, public.revenue, public.members, public.coaches, public.coach_applications, public.bookings, public.reviews, public.community_posts, public.messages to service_role;
grant update, delete on public.members, public.coaches, public.coach_applications, public.bookings, public.reviews, public.community_posts, public.messages, public.rate_limits to service_role;

create or replace function public.consume_rate_limit(
    p_key text,
    p_limit integer,
    p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_attempts integer;
begin
    insert into public.rate_limits as stored_limit (rate_key, window_started_at, attempts)
    values (p_key, now(), 1)
    on conflict (rate_key) do update
    set
        window_started_at = case
            when stored_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
                then now()
            else stored_limit.window_started_at
        end,
        attempts = case
            when stored_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
                then 1
            else stored_limit.attempts + 1
        end
    returning attempts into current_attempts;

    return current_attempts <= p_limit;
end;
$$;

create or replace function public.admin_dashboard()
returns jsonb
language sql
security definer
set search_path = ''
as $$
    with local_clock as (
        select
            timezone('Asia/Ho_Chi_Minh', now()) as local_now,
            date_trunc('month', timezone('Asia/Ho_Chi_Minh', now()))::date as current_month,
            date_trunc('day', timezone('Asia/Ho_Chi_Minh', now())) as local_day
    ),
    month_starts as (
        select generate_series(
            date_trunc('month', timezone('Asia/Ho_Chi_Minh', now())) - interval '5 months',
            date_trunc('month', timezone('Asia/Ho_Chi_Minh', now())),
            interval '1 month'
        )::date as month_start
    ),
    revenue_by_month as (
        select
            date_trunc('month', timezone('Asia/Ho_Chi_Minh', created_at))::date as month_start,
            sum(amount)::bigint as amount
        from public.revenue
        group by 1
    ),
    registration_goals as (
        select coalesce(nullif(goal, ''), 'unspecified') as goal, count(*)::integer as count
        from public.registrations
        group by 1
    )
    select jsonb_build_object(
        'revenueCurrentMonth',
            coalesce((
                select sum(r.amount)::bigint
                from public.revenue r
                cross join local_clock c
                where date_trunc('month', timezone('Asia/Ho_Chi_Minh', r.created_at))::date = c.current_month
            ), 0),
        'registrationsTotal', (select count(*) from public.registrations),
        'registrationsToday', (
            select count(*)
            from public.registrations r
            cross join local_clock c
            where r.submitted_at >= (c.local_day at time zone 'Asia/Ho_Chi_Minh')
                and r.submitted_at < ((c.local_day + interval '1 day') at time zone 'Asia/Ho_Chi_Minh')
        ),
        'revenueByMonth', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'month', to_char(m.month_start, 'YYYY-MM'),
                    'amount', coalesce(r.amount, 0)
                ) order by m.month_start
            )
            from month_starts m
            left join revenue_by_month r using (month_start)
        ), '[]'::jsonb),
        'recentRegistrations', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'id', recent.id,
                    'name', recent.name,
                    'phone', recent.phone,
                    'goal', recent.goal,
                    'submittedAt', recent.submitted_at
                ) order by recent.submitted_at desc
            )
            from (
                select id, name, phone, goal, submitted_at
                from public.registrations
                order by submitted_at desc
                limit 5
            ) recent
        ), '[]'::jsonb),
        'registrationGoals', coalesce((
            select jsonb_agg(
                jsonb_build_object('goal', goal, 'count', count)
                order by count desc
            )
            from registration_goals
        ), '[]'::jsonb)
    );
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_dashboard() from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.admin_dashboard() to service_role;
