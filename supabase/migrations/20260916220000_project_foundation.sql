begin;

create table agentic_delivery.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 4000),
  owner_user_id text not null check (length(trim(owner_user_id)) between 1 and 256),
  created_at timestamptz not null default now()
);
create index projects_owner_idx on agentic_delivery.projects(owner_user_id);

create table agentic_delivery.project_members (
  project_id uuid not null references agentic_delivery.projects(id),
  user_id text not null check (length(trim(user_id)) between 1 and 256),
  role text not null check (role in ('admin','member','tester','viewer')),
  created_at timestamptz not null default now(),
  primary key(project_id, user_id)
);
create index project_members_user_idx on agentic_delivery.project_members(user_id, project_id);

-- Legacy deliveries remain intact and unassigned. Never guess their owner.
alter table agentic_delivery.deliveries
  add column project_id uuid references agentic_delivery.projects(id),
  add column created_by text,
  add column request_id uuid,
  add constraint deliveries_project_request_unique unique(project_id, request_id),
  add constraint deliveries_project_id_unique unique(project_id, id);
create index deliveries_project_idx on agentic_delivery.deliveries(project_id, id desc);

create table agentic_delivery.project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references agentic_delivery.projects(id),
  actor_user_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index project_events_project_idx on agentic_delivery.project_events(project_id, id desc);

create table agentic_delivery.runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references agentic_delivery.projects(id),
  delivery_id bigint not null,
  status text not null default 'queued' check (status in ('queued','leased','running','waiting_for_input','waiting_for_approval','waiting_for_quota','retry_scheduled','completed','failed','cancelled')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, id),
  unique(delivery_id),
  foreign key(project_id, delivery_id) references agentic_delivery.deliveries(project_id, id)
);
create index runs_project_idx on agentic_delivery.runs(project_id, created_at desc);

create table agentic_delivery.run_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  run_id uuid not null,
  position integer not null check(position >= 0),
  name text not null,
  status text not null default 'queued' check (status in ('queued','leased','running','waiting_for_input','waiting_for_approval','waiting_for_quota','retry_scheduled','completed','failed','cancelled')),
  resume_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, position),
  foreign key(project_id, run_id) references agentic_delivery.runs(project_id, id)
);

-- Future workers must additionally enforce leases, checkpoint persistence and
-- compare-and-swap. No public state-mutation/worker API is exposed in this slice.
create function agentic_delivery.valid_run_transition(old_state text, new_state text)
returns boolean language sql immutable set search_path = '' as $$
  select old_state = new_state or case old_state
    when 'queued' then new_state in ('leased','cancelled')
    when 'leased' then new_state in ('running','retry_scheduled','failed','cancelled')
    when 'running' then new_state in ('waiting_for_input','waiting_for_approval','waiting_for_quota','completed','failed','cancelled','retry_scheduled')
    when 'waiting_for_input' then new_state in ('queued','cancelled')
    when 'waiting_for_approval' then new_state in ('queued','completed','cancelled')
    when 'waiting_for_quota' then new_state in ('retry_scheduled','cancelled')
    when 'retry_scheduled' then new_state in ('leased','cancelled')
    else false end;
$$;
create function agentic_delivery.guard_run_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not agentic_delivery.valid_run_transition(old.status, new.status) then
    raise exception 'Invalid execution transition' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger runs_transition before update on agentic_delivery.runs
for each row execute function agentic_delivery.guard_run_transition();
create trigger run_steps_transition before update on agentic_delivery.run_steps
for each row execute function agentic_delivery.guard_run_transition();

create function agentic_delivery.project_role(p_project uuid, p_actor text)
returns text language sql stable set search_path = '' as $$
  select case when p.owner_user_id = p_actor then 'owner' else m.role end
  from agentic_delivery.projects p
  left join agentic_delivery.project_members m on m.project_id = p.id and m.user_id = p_actor
  where p.id = p_project;
$$;
create function agentic_delivery.list_projects(p_actor text)
returns table(id uuid, name text, description text, owner_user_id text, created_at timestamptz, role text)
language sql stable set search_path = '' as $$
  select p.id,p.name,p.description,p.owner_user_id,p.created_at,
    case when p.owner_user_id = p_actor then 'owner' else m.role end
  from agentic_delivery.projects p
  left join agentic_delivery.project_members m on m.project_id = p.id and m.user_id = p_actor
  where p.owner_user_id = p_actor or m.user_id is not null
  order by p.created_at desc;
$$;
create function agentic_delivery.create_project(p_actor text, p_name text, p_description text)
returns jsonb language plpgsql set search_path = '' as $$
declare v_project agentic_delivery.projects;
begin
  insert into agentic_delivery.projects(name,description,owner_user_id)
    values(trim(p_name),coalesce(p_description,''),p_actor) returning * into v_project;
  insert into agentic_delivery.project_events(project_id,actor_user_id,kind)
    values(v_project.id,p_actor,'project.created');
  return to_jsonb(v_project) || jsonb_build_object('role','owner');
end;
$$;
create function agentic_delivery.set_project_member(p_actor text, p_project uuid, p_user text, p_role text)
returns void language plpgsql set search_path = '' as $$
declare v_owner text;
begin
  select owner_user_id into v_owner from agentic_delivery.projects where id = p_project for update;
  if v_owner is null or v_owner <> p_actor then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_user = v_owner or p_user is null or length(trim(p_user)) not between 1 and 256
    or (p_role is not null and p_role not in ('admin','member','tester','viewer')) then
    raise exception 'Invalid member' using errcode = '22023';
  end if;
  if p_role is null then
    delete from agentic_delivery.project_members where project_id = p_project and user_id = p_user;
  else
    insert into agentic_delivery.project_members(project_id,user_id,role) values(p_project,p_user,p_role)
      on conflict(project_id,user_id) do update set role = excluded.role;
  end if;
  insert into agentic_delivery.project_events(project_id,actor_user_id,kind,payload)
    values(p_project,p_actor,case when p_role is null then 'member.removed' else 'member.updated' end,
      jsonb_build_object('user_id',p_user,'role',p_role));
end;
$$;
create function agentic_delivery.create_project_delivery(p_actor text,p_project uuid,p_title text,p_objective text,p_request uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_role text;
  v_delivery agentic_delivery.deliveries;
  v_run agentic_delivery.runs;
begin
  -- Serializes membership changes and retried submissions for this project.
  perform 1 from agentic_delivery.projects where id = p_project for update;
  v_role := agentic_delivery.project_role(p_project,p_actor);
  if v_role is null or v_role = 'viewer' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_request is null or p_title is null or p_objective is null
    or length(trim(p_title)) not between 1 and 200 or length(trim(p_objective)) not between 1 and 20000 then
    raise exception 'Invalid delivery' using errcode = '22023';
  end if;
  select * into v_delivery from agentic_delivery.deliveries where project_id = p_project and request_id = p_request;
  if found then
    if v_delivery.title <> trim(p_title) or v_delivery.objective <> trim(p_objective) or v_delivery.created_by <> p_actor then
      raise exception 'Idempotency conflict' using errcode = '23505';
    end if;
    select * into v_run from agentic_delivery.runs where delivery_id = v_delivery.id;
    return jsonb_build_object('delivery',to_jsonb(v_delivery),'run',to_jsonb(v_run));
  end if;
  insert into agentic_delivery.deliveries(code,title,objective,project_id,created_by,request_id)
    values('DT-' || gen_random_uuid()::text,trim(p_title),trim(p_objective),p_project,p_actor,p_request)
    returning * into v_delivery;
  insert into agentic_delivery.runs(project_id,delivery_id,created_by)
    values(p_project,v_delivery.id,p_actor) returning * into v_run;
  insert into agentic_delivery.run_steps(project_id,run_id,position,name)
    values(p_project,v_run.id,0,'discovery');
  insert into agentic_delivery.project_events(project_id,actor_user_id,kind,payload)
    values(p_project,p_actor,'delivery.created',jsonb_build_object('delivery_id',v_delivery.id,'run_id',v_run.id));
  return jsonb_build_object('delivery',to_jsonb(v_delivery),'run',to_jsonb(v_run));
end;
$$;

-- Only the server service role may access the schema or call actor-bound RPCs.
-- Actor IDs come from trusted dispatch identity, never from request bodies.
alter table agentic_delivery.projects enable row level security;
alter table agentic_delivery.project_members enable row level security;
alter table agentic_delivery.project_events enable row level security;
alter table agentic_delivery.runs enable row level security;
alter table agentic_delivery.run_steps enable row level security;
revoke all on all tables in schema agentic_delivery from public, anon, authenticated;
revoke all on all sequences in schema agentic_delivery from public, anon, authenticated;
revoke all on all functions in schema agentic_delivery from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema agentic_delivery to service_role;
grant usage, select on all sequences in schema agentic_delivery to service_role;
grant execute on all functions in schema agentic_delivery to service_role;
-- Append-only audit trail via the application service role.
revoke update, delete on agentic_delivery.project_events from service_role;
notify pgrst, 'reload schema';
commit;
