-- Enoteca Italiana - Enterprise index cleanup
-- Esegui in Supabase SQL Editor.
-- Obiettivo: rimuovere indici duplicati mantenendo la copertura utile.

begin;

-- discharge_session_items(session_id) duplicates
drop index if exists public.idx_discharge_items_session_id;
drop index if exists public.idx_discharge_items_session;

-- discharge_session_items(wine_id) duplicates
drop index if exists public.idx_discharge_items_wine_id;
drop index if exists public.idx_discharge_items_wine;

-- wines(supplier) duplicate
drop index if exists public.wines_supplier_idx;

-- Refresh planner stats after index changes
analyze public.discharge_session_items;
analyze public.discharge_sessions;
analyze public.wines;

commit;
