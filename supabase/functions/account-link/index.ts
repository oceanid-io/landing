// POST /functions/v1/account-link
// Body: { token?: string }                (optional claim_token; legacy URLs)
// Auth: Authorization: Bearer <supabase_access_token>
//
// Effect: links the caller's waitlist row to their Supabase user id.
//
// Resolution order:
//   1. If a `token` is supplied, look up waitlist_links by claim_token (legacy path).
//   2. Otherwise, look up the waitlist row by the signed-in user's email and
//      link to the corresponding waitlist_links row.
//
// Idempotent.

import { verifyUser, serviceClient, HttpError, cors, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed' })

  try {
    const user = await verifyUser(req)
    const userEmail = (user.email || '').trim().toLowerCase()

    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()

    const supabase = serviceClient()

    // Resolve the waitlist_links row to link.
    let link: { waitlist_id: string; linked_user_id: string | null } | null = null
    if (token) {
      const { data, error } = await supabase
        .from('waitlist_links')
        .select('waitlist_id, linked_user_id')
        .eq('claim_token', token)
        .maybeSingle()
      if (error) throw new Error(`waitlist_links lookup by token: ${error.message}`)
      link = data ?? null
    } else if (userEmail) {
      // Match by signed-in user's email — newest signup wins if duplicates exist.
      const { data: wlRow, error: wlErr } = await supabase
        .from('waitlist')
        .select('id')
        .ilike('email', userEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (wlErr) throw new Error(`waitlist email lookup: ${wlErr.message}`)
      if (wlRow) {
        const { data, error } = await supabase
          .from('waitlist_links')
          .select('waitlist_id, linked_user_id')
          .eq('waitlist_id', wlRow.id)
          .maybeSingle()
        if (error) throw new Error(`waitlist_links lookup by email: ${error.message}`)
        link = data ?? null
      }
    }

    if (!link) return jsonResponse(200, { ok: true, linked: false })

    if (link.linked_user_id && link.linked_user_id !== user.id) {
      return jsonResponse(409, { ok: false, error: 'This waitlist entry is already linked to a different account' })
    }
    if (link.linked_user_id === user.id) {
      return jsonResponse(200, { ok: true, linked: true, already: true })
    }

    const { error: updErr } = await supabase
      .from('waitlist_links')
      .update({ linked_user_id: user.id, linked_at: new Date().toISOString() })
      .eq('waitlist_id', link.waitlist_id)
    if (updErr) throw new Error(`waitlist_links link: ${updErr.message}`)

    return jsonResponse(200, { ok: true, linked: true })
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse(err.status, { ok: false, error: err.message })
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse(500, { ok: false, error: message })
  }
})
