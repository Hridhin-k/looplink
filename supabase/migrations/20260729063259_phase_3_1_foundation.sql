-- Phase 3.1 — Infrastructure foundation
--
-- Prepares the database for additive SaaS schema migrations.
-- No domain tables (workspaces, memberships, etc.) in this phase.
--
-- gen_random_uuid() is available in PostgreSQL 13+ without an extension.
-- pgcrypto remains useful for future cryptographic helpers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
