-- Enoteca Italiana - Text casing policy (wines + registries)
-- Scope:
--  - wines.category => Initial Uppercase
--  - wines.name, wines.origin => UPPERCASE
--  - wines.producer, wines.supplier => Initial Uppercase
--  - categories.name => Initial Uppercase
--  - origins.name => UPPERCASE
--  - suppliers.name => Initial Uppercase
--
-- Safe to re-run (idempotent).

begin;

create or replace function public._enoteca_compact_spaces(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(trim(coalesce(value, '')), '\s+', ' ', 'g'), '');
$$;

create or replace function public._enoteca_upper(value text)
returns text
language sql
immutable
as $$
  select case
    when public._enoteca_compact_spaces(value) is null then null
    else upper(public._enoteca_compact_spaces(value))
  end;
$$;

create or replace function public._enoteca_initcap(value text)
returns text
language sql
immutable
as $$
  select case
    when public._enoteca_compact_spaces(value) is null then null
    else initcap(lower(public._enoteca_compact_spaces(value)))
  end;
$$;

create or replace function public.enoteca_normalize_wines_case()
returns trigger
language plpgsql
as $$
begin
  if new.category is not null then new.category := public._enoteca_initcap(new.category); end if;
  if new.name is not null then new.name := public._enoteca_upper(new.name); end if;
  if new.origin is not null then new.origin := public._enoteca_upper(new.origin); end if;
  if new.producer is not null then new.producer := public._enoteca_initcap(new.producer); end if;
  if new.supplier is not null then new.supplier := public._enoteca_initcap(new.supplier); end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.wines') is not null then
    execute 'drop trigger if exists trg_enoteca_wines_case on public.wines';
    execute 'create trigger trg_enoteca_wines_case before insert or update on public.wines for each row execute function public.enoteca_normalize_wines_case()';
    execute '
      update public.wines
      set
        category = public._enoteca_initcap(category),
        name = public._enoteca_upper(name),
        origin = public._enoteca_upper(origin),
        producer = public._enoteca_initcap(producer),
        supplier = public._enoteca_initcap(supplier)
    ';
  end if;
end $$;

create or replace function public.enoteca_normalize_categories_case()
returns trigger
language plpgsql
as $$
begin
  if new.name is not null then new.name := public._enoteca_initcap(new.name); end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.categories') is not null then
    execute 'drop trigger if exists trg_enoteca_categories_case on public.categories';
    execute 'create trigger trg_enoteca_categories_case before insert or update on public.categories for each row execute function public.enoteca_normalize_categories_case()';
  end if;
end $$;

create or replace function public.enoteca_normalize_suppliers_case()
returns trigger
language plpgsql
as $$
begin
  if new.name is not null then new.name := public._enoteca_initcap(new.name); end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.suppliers') is not null then
    execute 'drop trigger if exists trg_enoteca_suppliers_case on public.suppliers';
    execute 'create trigger trg_enoteca_suppliers_case before insert or update on public.suppliers for each row execute function public.enoteca_normalize_suppliers_case()';
  end if;
end $$;

create or replace function public.enoteca_normalize_origins_case()
returns trigger
language plpgsql
as $$
begin
  if new.name is not null then new.name := public._enoteca_upper(new.name); end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.origins') is not null then
    execute 'drop trigger if exists trg_enoteca_origins_case on public.origins';
    execute 'create trigger trg_enoteca_origins_case before insert or update on public.origins for each row execute function public.enoteca_normalize_origins_case()';
  end if;
end $$;

commit;
