// POST /functions/v1/account-link
// Body: { token: string }                 (the waitlist claim_token from the welcome email)
// Auth: Authorization: Bearer <supabase_access_token>
//
// Effect: links the matching waitlist_links row to the caller's Supabase user id.
// Idempotent.

import { verifyUser, serviceClient, HttpError, cors, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed' })

  try {
    const user = await verifyUser(req)

    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()
    if (!token) return jsonResponse(400, { ok: false, error: 'Missing token' })

    const supabase = serviceClient()

    const { data: link, error: selErr } = await supabase
      .from('waitlist_links')
      .select('waitlist_id, linked_user_id')
      .eq('claim_token', token)
      .maybeSingle()
    if (selErr) throw new Error(`waitlist_links lookup: ${selErr.message}`)

    if (!link) return jsonResponse(200, { ok: true, linked: false })

    if (link.linked_user_id && link.linked_user_id !== user.id) {
      return jsonResponse(409, { ok: false, error: 'Token already linked to a different account' })
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
