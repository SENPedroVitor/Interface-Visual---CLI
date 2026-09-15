-- Waddle cloud foundation for Supabase/PostgreSQL.
-- The desktop SQLite schema does not have an owner boundary. Cloud rows are
-- therefore scoped to a workspace, whose owner/members come from auth.users.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) between 1 and 120),
    created_by uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'member' check (role in ('owner', 'admin', 'member')),
    created_at timestamptz not null default now(),
    primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = target_workspace_id
          and wm.user_id = (select auth.uid())
    );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = target_workspace_id
          and wm.user_id = (select auth.uid())
          and wm.role in ('owner', 'admin')
    );
$$;

create or replace function public.is_workspace_creator(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspaces w
        where w.id = target_workspace_id
          and w.created_by = (select auth.uid())
    );
$$;

create or replace function public.prevent_workspace_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.created_by is distinct from old.created_by then
        raise exception 'workspace owner cannot be changed';
    end if;
    return new;
end;
$$;

drop trigger if exists workspace_owner_immutable on public.workspaces;
create trigger workspace_owner_immutable
before update on public.workspaces
for each row execute function public.prevent_workspace_owner_change();

create table if not exists public.agents (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    role text not null,
    description text not null default '',
    provider_id text not null default 'ollama',
    workspace_path text not null default '',
    soul text not null default '',
    skills jsonb not null default '[]'::jsonb,
    memory jsonb not null default '[]'::jsonb,
    avatar_config jsonb not null default '{}'::jsonb,
    model_config jsonb not null default '{}'::jsonb,
    status text not null default 'idle',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, name),
    unique (workspace_id, id)
);

create table if not exists public.groups (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    description text not null default '',
    avatar_icon text not null default 'users',
    created_at timestamptz not null default now(),
    unique (workspace_id, name),
    unique (workspace_id, id)
);

create table if not exists public.group_members (
    group_id uuid not null references public.groups(id) on delete cascade,
    agent_id uuid not null references public.agents(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (group_id, agent_id),
    foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete cascade,
    foreign key (workspace_id, agent_id) references public.agents(workspace_id, id) on delete cascade
);

create table if not exists public.runs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    objective text not null,
    status text not null default 'pending',
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    unique (workspace_id, id)
);

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    run_id uuid,
    title text not null,
    description text,
    assigned_agent uuid,
    status text not null default 'pending',
    priority text not null default 'normal',
    dependencies jsonb not null default '[]'::jsonb,
    input_data jsonb not null default '{}'::jsonb,
    output_data jsonb not null default '{}'::jsonb,
    error text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz,
    unique (workspace_id, id),
    foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete cascade,
    foreign key (workspace_id, assigned_agent) references public.agents(workspace_id, id) on delete set null (assigned_agent)
);

create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    event_type text not null,
    source text not null,
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    from_agent uuid,
    to_agent uuid,
    msg_type text not null default 'message',
    content text not null,
    task_id uuid,
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    foreign key (workspace_id, from_agent) references public.agents(workspace_id, id) on delete set null (from_agent),
    foreign key (workspace_id, to_agent) references public.agents(workspace_id, id) on delete set null (to_agent),
    foreign key (workspace_id, task_id) references public.tasks(workspace_id, id) on delete set null (task_id)
);

create table if not exists public.routines (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    agent_id uuid not null,
    prompt text not null,
    schedule text not null,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    unique (workspace_id, name),
    unique (workspace_id, id),
    foreign key (workspace_id, agent_id) references public.agents(workspace_id, id) on delete cascade
);

create table if not exists public.routine_runs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    routine_id uuid not null,
    status text not null default 'pending',
    triggered_at timestamptz not null default now(),
    completed_at timestamptz,
    foreign key (workspace_id, routine_id) references public.routines(workspace_id, id) on delete cascade
);

create table if not exists public.tool_calls (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    tool_name text not null,
    agent_id uuid,
    task_id uuid,
    params jsonb not null default '{}'::jsonb,
    result jsonb not null default '{}'::jsonb,
    success boolean not null default false,
    error text,
    duration_ms double precision,
    created_at timestamptz not null default now(),
    foreign key (workspace_id, agent_id) references public.agents(workspace_id, id) on delete set null (agent_id),
    foreign key (workspace_id, task_id) references public.tasks(workspace_id, id) on delete set null (task_id)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_agents_workspace on public.agents(workspace_id);
create index if not exists idx_groups_workspace on public.groups(workspace_id);
create index if not exists idx_group_members_workspace on public.group_members(workspace_id);
create index if not exists idx_runs_workspace_created on public.runs(workspace_id, created_at desc);
create index if not exists idx_tasks_workspace_status on public.tasks(workspace_id, status);
create index if not exists idx_tasks_run on public.tasks(run_id);
create index if not exists idx_events_workspace_created on public.events(workspace_id, created_at desc);
create index if not exists idx_messages_workspace_created on public.messages(workspace_id, created_at desc);
create index if not exists idx_routines_workspace on public.routines(workspace_id);
create index if not exists idx_routine_runs_routine_triggered on public.routine_runs(routine_id, triggered_at desc);
create index if not exists idx_tool_calls_workspace_created on public.tool_calls(workspace_id, created_at desc);

-- RLS is enabled on every client-visible table. Service-role workers can still
-- operate through Supabase's service role, while browser clients are scoped by
-- auth.uid() membership.
do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'workspaces', 'workspace_members', 'agents', 'groups', 'group_members',
        'runs', 'tasks', 'events', 'messages', 'routines', 'routine_runs',
        'tool_calls'
    ] loop
        execute format('alter table public.%I enable row level security', table_name);
    end loop;
end $$;

create policy workspaces_member_select on public.workspaces
    for select using (public.is_workspace_member(id));
create policy workspaces_owner_insert on public.workspaces
    for insert with check ((select auth.uid()) = created_by);
create policy workspaces_member_update on public.workspaces
    for update using (public.is_workspace_member(id))
    with check (public.is_workspace_member(id));

create policy workspace_members_self_select on public.workspace_members
    for select using (user_id = (select auth.uid()) or public.is_workspace_member(workspace_id));
create policy workspace_members_admin_insert on public.workspace_members
    for insert with check (
        public.is_workspace_admin(workspace_id)
        or (
            user_id = (select auth.uid())
            and role = 'owner'
            and public.is_workspace_creator(workspace_id)
        )
    );
create policy workspace_members_admin_update on public.workspace_members
    for update using (public.is_workspace_admin(workspace_id))
    with check (public.is_workspace_admin(workspace_id));
create policy workspace_members_admin_delete on public.workspace_members
    for delete using (public.is_workspace_admin(workspace_id));

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'agents', 'groups', 'runs', 'tasks', 'events',
        'messages', 'routines', 'routine_runs', 'tool_calls'
    ] loop
        execute format(
            'create policy %I_workspace_member_all on public.%I for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
            table_name, table_name
        );
    end loop;
end $$;

create policy group_members_workspace_member_all on public.group_members
    for all using (
        public.is_workspace_member(workspace_id)
    ) with check (public.is_workspace_member(workspace_id));

-- Enable Realtime for the collaboration primitives when the publication exists.
do $$
begin
    alter publication supabase_realtime add table public.events;
    alter publication supabase_realtime add table public.messages;
exception when duplicate_object or undefined_object then
    null;
end $$;
