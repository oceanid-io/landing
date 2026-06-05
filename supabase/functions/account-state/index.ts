// GET (or POST) /functions/v1/account-state
// Auth: Authorization: Bearer <supabase_access_token>

import { verifyUser, serviceClient, HttpError, cors, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' })
  }

  try {
    const user = await verifyUser(req)
    const supabase = serviceClient()

    // 1. Link row already tied to this user?
    let linkedWaitlistId: string | null = null
    {
      const { data: link, error } = await supabase
        .from('waitlist_links')
        .select('waitlist_id')
        .eq('linked_user_id', user.id)
        .maybeSingle()
      if (error) throw new Error(`waitlist_links by user: ${error.message}`)
      if (link) linkedWaitlistId = link.waitlist_id
    }

    // 2. Soft-link by email if not yet linked.
    if (!linkedWaitlistId && user.email) {
      const { data: wlRows, error: wlErr } = await supabase
        .from('waitlist')
        .select('id')
        .ilike('email', user.email)
      if (wlErr) throw new Error(`waitlist email lookup: ${wlErr.message}`)

      for (const row of wlRows ?? []) {
        const { data: candidate, error: linkErr } = await supabase
          .from('waitlist_links')
          .select('waitlist_id, linked_user_id')
          .eq('waitlist_id', row.id)
          .maybeSingle()
        if (linkErr) throw new Error(`waitlist_links candidate: ${linkErr.message}`)

        if (!candidate) {
          const { error: insErr } = await supabase
            .from('waitlist_links')
            .insert({
              waitlist_id: row.id,
              linked_user_id: user.id,
              linked_at: new Date().toISOString(),
            })
          if (insErr && !insErr.message.includes('duplicate')) {
            throw new Error(`waitlist_links insert: ${insErr.message}`)
          }
          linkedWaitlistId = row.id
          break
        }

        if (!candidate.linked_user_id) {
          const { error: updErr } = await supabase
            .from('waitlist_links')
            .update({ linked_user_id: user.id, linked_at: new Date().toISOString() })
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
      .eq('user_id', user.id)
      .maybeSingle()
    if (claimErr) throw new Error(`reward_claims lookup: ${claimErr.message}`)

    return jsonResponse(200, {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, picture: user.picture },
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
