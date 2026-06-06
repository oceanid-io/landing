-- Persist the reward the user picked on the landing form so /account can
-- show it back to them and let them switch before they claim it.
--
-- Lives on waitlist_links (the CRM-owned `waitlist` table is untouched).

ALTER TABLE waitlist_links
    ADD COLUMN IF NOT EXISTS preselected_reward_code TEXT
        CHECK (preselected_reward_code IN (
            'OPER_PRO_3M',
            'OPER_FEE_WAIVER_3M',
            'TRAV_FEE_WAIVER_3M'
        ));
