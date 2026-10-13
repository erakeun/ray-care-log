-- Apply to a dedicated Supabase project only after explicit deployment approval.
-- Do not enroll users before their identity and email have been verified.
create schema if not exists car_care_private;
revoke all on schema car_care_private from public, anon, authenticated;
create table car_care_private.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enrolled_at timestamptz not null default now()
);
create table public.car_care_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check(revision >= 0),
  payload jsonb,
  updated_at timestamptz not null default now()
);
create table public.car_care_versions (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check(revision > 0),
  mutation_id uuid not null,
  expected_revision bigint not null,
  reason text not null check(reason in ('edit','migration','restore','blank')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,revision), unique(user_id,mutation_id)
);
alter table public.car_care_documents enable row level security;
alter table public.car_care_documents force row level security;
alter table public.car_care_versions enable row level security;
alter table public.car_care_versions force row level security;
create function public.car_care_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from car_care_private.members where user_id=auth.uid());
$$;
revoke all on function public.car_care_member() from public,anon;
grant execute on function public.car_care_member() to authenticated;
create policy own_documents on public.car_care_documents for select to authenticated
using(user_id=(select auth.uid()) and (select public.car_care_member()));
create policy own_versions on public.car_care_versions for select to authenticated
using(user_id=(select auth.uid()) and (select public.car_care_member()));
revoke all on public.car_care_documents,public.car_care_versions from public,anon,authenticated;
grant select on public.car_care_documents,public.car_care_versions to authenticated;

-- Input helpers are internal, callable only by the function owner.
create function car_care_private.keys(v jsonb,k text[]) returns boolean language sql immutable as $$
 select jsonb_typeof(v)='object' and v ?& k and (select count(*) from jsonb_object_keys(v))=cardinality(k);
$$;
create function car_care_private.text_ok(v jsonb,n integer) returns boolean language sql immutable as $$
 select jsonb_typeof(v)='string' and length(v#>>'{}')<=n;
$$;
create function car_care_private.int_ok(v jsonb,lo bigint,hi bigint) returns boolean language sql immutable as $$
 select case when jsonb_typeof(v)='number' and (v#>>'{}')~'^[0-9]+$' then (v#>>'{}')::numeric between lo and hi else false end;
$$;
create function car_care_private.valid_payload(p jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare v jsonb; i jsonb; r jsonb; b jsonb; ids text[]='{}'; rids text[]='{}'; last_km bigint; d text;
begin
 if p is null or octet_length(p::text)>3000000 or not car_care_private.keys(p,array['schemaVersion','appId','vehicle','items','records']) or p->'schemaVersion' not in ('1'::jsonb,'2'::jsonb) then return false;end if;
 if p->>'appId'<>'ray-care-log' then return false;end if;
 v=p->'vehicle';
 if not car_care_private.keys(v,case when p->'schemaVersion'='1'::jsonb then array['name','odometer','fuel','type'] else array['name','odometer','fuel','type','year','engine','transmission','usage'] end) or not car_care_private.text_ok(v->'name',60) or not car_care_private.text_ok(v->'fuel',30) or not car_care_private.text_ok(v->'type',60) or (v->'odometer'<>'null'::jsonb and not car_care_private.int_ok(v->'odometer',0,9999999)) then return false;end if;
 if p->'schemaVersion'='2'::jsonb then
  if not car_care_private.text_ok(v->'year',4) or (v->>'year'<>'' and ((v->>'year')!~'^\d{4}$' or (v->>'year')::integer<1900 or (v->>'year')::integer>extract(year from now() at time zone 'Asia/Seoul')+1)) or not car_care_private.text_ok(v->'engine',100) or not car_care_private.text_ok(v->'transmission',10) or v->>'transmission' not in ('','자동','수동','CVT','DCT','기타') or not car_care_private.text_ok(v->'usage',20) or v->>'usage' not in ('','일반','가혹조건 가능','미확인') then return false;end if;
 end if;
 if jsonb_typeof(p->'items')<>'array' or jsonb_typeof(p->'records')<>'array' or jsonb_array_length(p->'items')>100 or jsonb_array_length(p->'records')>10000 then return false;end if;
 for i in select value from jsonb_array_elements(p->'items') loop
  if not car_care_private.keys(i,array['id','name','kind','note','intervalKm','intervalMonths','confirmed','baselineId']) or not car_care_private.text_ok(i->'id',80) or i->>'id'='' or i->>'id'=any(ids) or not car_care_private.text_ok(i->'name',80) or btrim(i->>'name')='' or not car_care_private.text_ok(i->'kind',20) or i->>'kind' not in ('점검','교체','수리','선택 관리') or not car_care_private.text_ok(i->'note',500) or jsonb_typeof(i->'confirmed')<>'boolean' or (i->'baselineId'<>'null'::jsonb and not car_care_private.text_ok(i->'baselineId',80)) or (i->'intervalKm'<>'null'::jsonb and not car_care_private.int_ok(i->'intervalKm',1,1000000)) or (i->'intervalMonths'<>'null'::jsonb and not car_care_private.int_ok(i->'intervalMonths',1,600)) or (i->'confirmed'='true'::jsonb and i->'intervalKm'='null'::jsonb and i->'intervalMonths'='null'::jsonb) then return false;end if;
  ids=array_append(ids,i->>'id');
 end loop;
 for r in select value from jsonb_array_elements(p->'records') loop
  if not car_care_private.keys(r,array['id','itemId','date','km','note']) or not car_care_private.text_ok(r->'id',80) or r->>'id'='' or r->>'id'=any(rids) or not car_care_private.text_ok(r->'itemId',80) or not((r->>'itemId')=any(ids)) or not car_care_private.text_ok(r->'note',1000) or (r->'date'='null'::jsonb and r->'km'='null'::jsonb) or (r->'km'<>'null'::jsonb and (not car_care_private.int_ok(r->'km',0,9999999) or v->'odometer'='null'::jsonb or (r->>'km')::bigint>(v->>'odometer')::bigint)) then return false;end if;
  if r->'date'<>'null'::jsonb then
   d=r->>'date';
   if jsonb_typeof(r->'date')<>'string' or d!~'^\d{4}-\d{2}-\d{2}$' or d<'1900-01-01' or d::date>(now() at time zone 'Asia/Seoul')::date or to_char(d::date,'YYYY-MM-DD')<>d then return false;end if;
  end if;
  rids=array_append(rids,r->>'id');
 end loop;
 for i in select value from jsonb_array_elements(p->'items') loop
  b=null;
  select value into b from jsonb_array_elements(p->'records') where value->>'itemId'=i->>'id' and value->>'id'=i->>'baselineId';
  if i->'baselineId'<>'null'::jsonb and b is null then return false;end if;
  last_km=null;
  for r in select value from jsonb_array_elements(p->'records') where value->>'itemId'=i->>'id' and value->'date'<>'null'::jsonb and value->'km'<>'null'::jsonb order by value->>'date',(value->>'km')::bigint loop
   if last_km is not null and (r->>'km')::bigint<last_km then return false;end if;last_km=(r->>'km')::bigint;
  end loop;
  if exists(select 1 from jsonb_array_elements(p->'records') where value->>'itemId'=i->>'id' group by value->'date',value->'km',value->'note' having count(*)>1) then return false;end if;
  if b is not null and exists(select 1 from jsonb_array_elements(p->'records') where value->>'itemId'=i->>'id' and ((value->'date'<>'null'::jsonb and b->'date'<>'null'::jsonb and value->>'date'>b->>'date') or (value->'km'<>'null'::jsonb and b->'km'<>'null'::jsonb and (value->>'km')::bigint>(b->>'km')::bigint))) then return false;end if;
 end loop;
 return true;
exception when others then return false;
end;$$;
revoke all on all functions in schema car_care_private from public,anon,authenticated;

create function public.car_care_read() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=auth.uid(); result jsonb;
begin
 if not public.car_care_member() then raise exception 'membership_required' using errcode='42501';end if;
 select jsonb_build_object('revision',revision,'payload',payload,'updated_at',updated_at) into result from public.car_care_documents where user_id=u and revision>0;
 return result;
end;$$;
create function public.car_care_save(p_payload jsonb,p_expected_revision bigint,p_mutation_id uuid,p_reason text default 'edit') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid=auth.uid(); doc public.car_care_documents%rowtype; old public.car_care_versions%rowtype;
begin
 if not public.car_care_member() then raise exception 'membership_required' using errcode='42501';end if;
 if p_expected_revision is null or p_expected_revision<0 or p_mutation_id is null or p_reason is null or p_reason not in ('edit','migration','restore','blank') or not car_care_private.valid_payload(p_payload) then raise exception 'invalid_payload' using errcode='22023';end if;
 -- Materialize and lock one row per authenticated user, including first migration races.
 insert into public.car_care_documents(user_id) values(u) on conflict(user_id) do nothing;
 select * into doc from public.car_care_documents where user_id=u for update;
 select * into old from public.car_care_versions where user_id=u and mutation_id=p_mutation_id;
 if found then
  if old.payload<>p_payload or old.expected_revision<>p_expected_revision or old.reason<>p_reason then raise exception 'mutation_mismatch' using errcode='22023';end if;
  return jsonb_build_object('revision',old.revision,'payload',old.payload,'updated_at',old.created_at);
 end if;
 if doc.revision<>p_expected_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 update public.car_care_documents set revision=doc.revision+1,payload=p_payload,updated_at=now() where user_id=u returning * into doc;
 insert into public.car_care_versions(user_id,revision,mutation_id,expected_revision,reason,payload) values(u,doc.revision,p_mutation_id,p_expected_revision,p_reason,p_payload);
 return jsonb_build_object('revision',doc.revision,'payload',doc.payload,'updated_at',doc.updated_at);
end;$$;
create function public.car_care_history() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.car_care_member() then raise exception 'membership_required' using errcode='42501';end if;
 select coalesce(jsonb_agg(row),'[]'::jsonb) into result from (select revision,reason,created_at from public.car_care_versions where user_id=auth.uid() order by revision desc limit 50) row;
 return result;
end;$$;
create function public.car_care_version(p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.car_care_member() then raise exception 'membership_required' using errcode='42501';end if;
 select jsonb_build_object('revision',revision,'payload',payload,'created_at',created_at) into result from public.car_care_versions where user_id=auth.uid() and revision=p_revision;
 if result is null then raise exception 'version_not_found' using errcode='P0002';end if;return result;
end;$$;
revoke all on function public.car_care_read(),public.car_care_save(jsonb,bigint,uuid,text),public.car_care_history(),public.car_care_version(bigint) from public,anon;
grant execute on function public.car_care_read(),public.car_care_save(jsonb,bigint,uuid,text),public.car_care_history(),public.car_care_version(bigint) to authenticated;
