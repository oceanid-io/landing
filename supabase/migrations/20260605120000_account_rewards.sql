-- Account + founding-member rewards.
--
-- The `waitlist` table is OWNED by the CRM flow and is not modified here.
-- A side table `waitlist_links` holds the claim_token + Auth0 linkage so
-- /account can match a signed-in user back to a waitlist row without
-- touching the original table or its triggers.

-- 1. Side table linking waitlist rows to Auth0 identities.
CREATE TABLE IF NOT EXISTS waitlist_links (
    waitlist_id       UUID PRIMARY KEY REFERENCES waitlist(id) ON DELETE CASCADE,
    claim_token       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    linked_auth0_sub  TEXT UNIQUE,
    linked_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_links_auth0_sub
    ON waitlist_links(linked_auth0_sub)
    WHERE linked_auth0_sub IS NOT NULL;

-- Backfill: every existing waitlist row gets a link row with a generated token
-- so old signups remain claimable. Idempotent via ON CONFLICT DO NOTHING.
INSERT INTO waitlist_links (waitlist_id)
SELECT id FROM waitlist
ON CONFLICT (waitlist_id) DO NOTHING;

-- 2. Reward claims. One per Auth0 user.
--    OPER_PRO_3M           — 3 months Oceanid PRO subscription, free
--    OPER_FEE_WAIVER_3M    — 0% operator platform fee for 3 months
--    TRAV_FEE_WAIVER_3M    — 0% traveler booking fee for 3 months
CREATE TABLE IF NOT EXISTS reward_claims (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth0_sub    TEXT NOT NULL,
    email        TEXT NOT NULL,
    waitlist_id  UUID REFERENCES waitlist(id) ON DELETE SET NULL,
    reward_code  TEXT NOT NULL
                  CHECK (reward_code IN (
                      'OPER_PRO_3M',
                      'OPER_FEE_WAIVER_3M',
                      'TRAV_FEE_WAIVER_3M'
                  )),
    promo_code   TEXT NOT NULL UNIQUE,
    status       TEXT NOT NULL DEFAULT 'RESERVED'
                  CHECK (status IN ('RESERVED', 'EMAILED', 'REDEEMED', 'EXPIRED')),
    expires_at   TIMESTAMPTZ,
    claimed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (auth0_sub)
);

CREATE INDEX IF NOT EXISTS idx_reward_claims_email
    ON reward_claims(email);

CREATE INDEX IF NOT EXISTS idx_reward_claims_waitlist_id
    ON reward_claims(waitlist_id)
    WHERE waitlist_id IS NOT NULL;

-- 3. RLS: deny everything by default. Service-role (used by edge functions)
--    bypasses RLS. Anon clients should never read these tables.
ALTER TABLE waitlist_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_claims  ENABLE ROW LEVEL SECURITY;
