-- =============================================================
-- Fix Supabase Security Advisor Warnings
-- Progetto: aezqtgadyaxdcptwlpci (gestionale)
-- Data: 03/05/2026
--
-- Come eseguire:
--   Dashboard Supabase → SQL Editor → incolla ed esegui
-- =============================================================

-- Fix 1: wines_before_write — Function Search Path Mutable
-- Aggiunge SET search_path per prevenire SQL injection via schema hijacking.
ALTER FUNCTION public.wines_before_write()
  SET search_path = public, pg_temp;

-- Fix 2: submit_discharge_session — SECURITY DEFINER search_path
-- La funzione deve restare SECURITY DEFINER (necessario per UPDATE su
-- discharge_sessions da ruolo anon, che non ha policy RLS UPDATE).
-- Aggiungere search_path fisso risolve il warning senza cambiare il comportamento.
ALTER FUNCTION public.submit_discharge_session(p_session_id uuid)
  SET search_path = public, pg_temp;

-- Verifica: dopo l'esecuzione i warning nel Security Advisor devono sparire.
-- Nota: il warning "Signed-In Users Can Execute SECURITY DEFINER Function"
-- per submit_discharge_session può essere accettato perché:
--   - La funzione verifica che la sessione esista e sia pending
--   - Non espone dati sensibili di altri utenti
--   - È protetta da logica applicativa (session_id UUID non indovinabile)
