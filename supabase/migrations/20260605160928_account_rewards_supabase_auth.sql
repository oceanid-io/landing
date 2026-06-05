-- Switch from Auth0 identity to Supabase Auth (auth.users).
-- Tables were empty/unlinked at apply time, so renames were safe.

ALTER TABLE waitlist_links DROP CONSTRAINT IF EXISTS waitlist_links_linked_auth0_sub_key;
DROP INDEX IF EXISTS idx_waitlist_links_auth0_sub;

ALTER TABLE waitlist_links DROP COLUMN IF EXISTS linked_auth0_sub;
ALTER TABLE waitlist_links
    ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE waitlist_links
    ADD CONSTRAINT waitlist_links_linked_user_id_key UNIQUE (linked_user_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_links_user_id
    ON waitlist_links(linked_user_id)
    WHERE linked_user_id IS NOT NULL;

ALTER TABLE reward_claims DROP CONSTRAINT IF EXISTS reward_claims_auth0_sub_key;
ALTER TABLE reward_claims DROP COLUMN IF EXISTS auth0_sub;
ALTER TABLE reward_claims
    ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE reward_claims
    ADD CONSTRAINT reward_claims_user_id_key UNIQUE (user_id);
