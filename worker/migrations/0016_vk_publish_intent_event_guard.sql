-- user_onboarding_intent_event has no CHECK constraints on action/waiting_for.
-- This migration intentionally documents that no schema rebuild is required for event rows.
SELECT 1;
