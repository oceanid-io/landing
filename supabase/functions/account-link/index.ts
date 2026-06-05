// POST /functions/v1/account-link
// Body: { token: string }                 (the waitlist claim_token from the welcome email)
// Auth: Authorization: Bearer <auth0_id_token>
//
// Effect: links the matching waitlist_links row to the caller's Auth0 sub.
// Idempotent — re-linking the same token to the same user is a no-op.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { verifyAuth0, HttpError, cors, jsonResponse } from '../_shared/auth0.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed' })

  try {
    const user = await verifyAuth0(req)

    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()
    if (!token) return jsonResponse(400, { ok: false, error: 'Missing token' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: link, error: selErr } = await supabase
      .from('waitlist_links')
      .select('waitlist_id, linked_auth0_sub')
      .eq('claim_token', token)
      .maybeSingle()
    if (selErr) throw new Error(`waitlist_links lookup: ${selErr.message}`)

    if (!link) {
      return jsonResponse(200, { ok: true, linked: false })
    }

    if (link.linked_auth0_sub && link.linked_auth0_sub !== user.sub) {
      return jsonResponse(409, { ok: false, error: 'Token already linked to a different account' })
    }

    if (link.linked_auth0_sub === user.sub) {
      return jsonResponse(200, { ok: true, linked: true, already: true })
    }

    const { error: updErr } = await supabase
      .from('waitlist_links')
      .update({
        linked_auth0_sub: user.sub,
        linked_at: new Date().toISOString(),
      })
      .eq('waitlist_id', link.waitlist_id)
    if (updErr) throw new Error(`waitlist_links link: ${updErr.message}`)

    return jsonResponse(200, { ok: true, linked: true })
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse(err.status, { ok: false, error: err.message })
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse(500, { ok: false, error: message })
  }
})
