// GET (or POST) /functions/v1/account-state
// Auth: Authorization: Bearer <auth0_id_token>
//
// Returns the data the /account dashboard needs:
//   - waitlist_linked: whether the signed-in user is linked to a waitlist row
//   - waitlist: { id, email, role } if linked
//   - reward_claim: the user's existing reward_claims row, or null

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { verifyAuth0, HttpError, cors, jsonResponse } from '../_shared/auth0.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' })
  }

  try {
    const user = await verifyAuth0(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Find a link row already tied to this Auth0 sub.
    let linkedWaitlistId: string | null = null
    {
      const { data: link, error } = await supabase
        .from('waitlist_links')
        .select('waitlist_id')
        .eq('linked_auth0_sub', user.sub)
        .maybeSingle()
      if (error) throw new Error(`waitlist_links by sub: ${error.message}`)
      if (link) linkedWaitlistId = link.waitlist_id
    }

    // 2. If not linked, try to soft-link by email match: find a waitlist row
    //    matching the user's email whose link row is still unlinked.
    if (!linkedWaitlistId && user.email) {
      const { data: wlRows, error: wlErr } = await supabase
        .from('waitlist')
        .select('id')
        .ilike('email', user.email)
      if (wlErr) throw new Error(`waitlist email lookup: ${wlErr.message}`)

      for (const row of wlRows ?? []) {
        const { data: candidate, error: linkErr } = await supabase
          .from('waitlist_links')
          .select('waitlist_id, linked_auth0_sub')
          .eq('waitlist_id', row.id)
          .maybeSingle()
        if (linkErr) throw new Error(`waitlist_links candidate: ${linkErr.message}`)

        // Backfill ensures every existing waitlist row has a link row, but
        // be defensive in case backfill ran before this waitlist row existed.
        if (!candidate) {
          const { error: insErr } = await supabase
            .from('waitlist_links')
            .insert({
              waitlist_id: row.id,
              linked_auth0_sub: user.sub,
              linked_at: new Date().toISOString(),
            })
          if (insErr && !insErr.message.includes('duplicate')) {
            throw new Error(`waitlist_links insert: ${insErr.message}`)
          }
          linkedWaitlistId = row.id
          break
        }

        if (!candidate.linked_auth0_sub) {
          const { error: updErr } = await supabase
            .from('waitlist_links')
            .update({
              linked_auth0_sub: user.sub,
              linked_at: new Date().toISOString(),
            })
            .eq('waitlist_id', row.id)
          if (updErr) throw new Error(`waitlist_links link by email: ${updErr.message}`)
          linkedWaitlistId = row.id
          break
        }
      }
    }

    let waitlistRow: { id: string; email: string; role: string | null } | null = null
    if (linkedWaitlistId) {
      const { data, error } = await supabase
        .from('waitlist')
        .select('id, email, role')
        .eq('id', linkedWaitlistId)
        .maybeSingle()
      if (error) throw new Error(`waitlist row fetch: ${error.message}`)
      waitlistRow = data
    }

    const { data: claim, error: claimErr } = await supabase
      .from('reward_claims')
      .select('id, reward_code, promo_code, status, expires_at, claimed_at')
      .eq('auth0_sub', user.sub)
      .maybeSingle()
    if (claimErr) throw new Error(`reward_claims lookup: ${claimErr.message}`)

    return jsonResponse(200, {
      ok: true,
      user: { sub: user.sub, email: user.email, name: user.name, picture: user.picture },
      waitlist_linked: Boolean(waitlistRow),
      waitlist: waitlistRow,
      reward_claim: claim ?? null,
    })
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse(err.status, { ok: false, error: err.message })
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse(500, { ok: false, error: message })
  }
})
