ALTER TABLE miniapp_drafts ADD COLUMN screen TEXT NOT NULL DEFAULT 'publish';
ALTER TABLE miniapp_drafts ADD COLUMN ai_state TEXT NOT NULL DEFAULT '';
