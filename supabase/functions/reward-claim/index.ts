// POST /functions/v1/reward-claim
// Body: { reward_code: 'OPER_PRO_3M' | 'OPER_FEE_WAIVER_3M' | 'TRAV_FEE_WAIVER_3M' }
// Auth: Authorization: Bearer <auth0_id_token>
//
// Records the chosen reward for the user, generates a unique promo code,
// emails the activation code. One reward per Auth0 user (UNIQUE constraint).
// Requires the user to be linked to a waitlist row via waitlist_links.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.2.0/mod.ts'
import { verifyAuth0, HttpError, cors, jsonResponse } from '../_shared/auth0.ts'

const REWARDS = {
  OPER_PRO_3M: {
    title: '3 months Oceanid PRO — free',
    body: 'Your PRO subscription is reserved free for 3 months from the day you upgrade in the Oceanid app. Unlimited vessels, unlimited paid trips.',
  },
  OPER_FEE_WAIVER_3M: {
    title: '0% platform commission for 3 months',
    body: 'We waive the operator commission on every booking for 3 months from your first paid trip.',
  },
  TRAV_FEE_WAIVER_3M: {
    title: 'No booking fees for 3 months',
    body: 'The 5% Oceanid traveler booking fee is waived on every trip you book in your first 3 months.',
  },
} as const
type RewardCode = keyof typeof REWARDS

function generatePromoCode(): string {
  const buf = new Uint8Array(8)
  crypto.getRandomValues(buf)
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `OCN-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildActivationHtml(name: string, rewardCode: RewardCode, promoCode: string): string {
  const r = REWARDS[rewardCode]
  const safeName = escapeHtml(name)
  const safePromo = escapeHtml(promoCode)
  const accountUrl = 'https://oceanid.io/account'
  const logo = 'https://storage.googleapis.com/oceanid-public/logo.png'
  const logoText = 'https://storage.googleapis.com/oceanid-public/logo-text.png'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Your Oceanid reward is locked in</title>
  </head>
  <body style="margin:0;padding:0;background:#eef4fb;color:#162033;font-family:Manrope,Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4fb;margin:0;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dce6f2;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(22,32,51,.12);">
          <tr><td style="padding:22px 26px;background:#ffffff;border-bottom:1px solid #e5edf6;">
            <a href="${accountUrl}" style="display:inline-flex;align-items:center;text-decoration:none;">
              <img src="${logo}" width="34" height="34" alt="Oceanid" style="display:inline-block;vertical-align:middle;border:0;margin-right:10px;">
              <img src="${logoText}" height="22" alt="Oceanid" style="display:inline-block;vertical-align:middle;border:0;max-width:150px;">
            </a>
          </td></tr>
          <tr><td style="padding:38px 32px 18px;background:#ffffff;">
            <p style="margin:0 0 10px;color:#5c6bc0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Your reward is locked in</p>
            <h1 style="margin:0 0 16px;color:#162033;font-size:30px;line-height:1.15;font-weight:800;">Nice pick, ${safeName}.</h1>
            <p style="margin:0;color:#39445a;font-size:16px;line-height:1.6;"><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.body)}</p>
          </td></tr>
          <tr><td style="padding:8px 32px 4px;background:#ffffff;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:18px 20px;background:#f5f8fc;border:1px solid #dce6f2;border-radius:14px;">
              <p style="margin:0 0 8px;color:#162033;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;">Activation code</p>
              <p style="margin:0;color:#162033;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:22px;font-weight:800;letter-spacing:.06em;">${safePromo}</p>
            </td></tr></table>
          </td></tr>
          <tr><td style="padding:18px 32px 4px;background:#ffffff;">
            <p style="margin:0 0 8px;color:#162033;font-size:16px;font-weight:800;">How to use it</p>
            <p style="margin:0;color:#39445a;font-size:14px;line-height:1.7;">Keep this code safe. We'll auto-apply it when you sign in to the Oceanid app and trigger the matching action — your first booking, your PRO upgrade, or your first paid trip. You can also reply to this email any time with the code if you need help.</p>
          </td></tr>
          <tr><td align="center" style="padding:22px 32px 26px;background:#ffffff;">
            <a href="${accountUrl}" style="display:inline-block;background:#5c6bc0;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;padding:14px 24px;border-radius:12px;">Back to your account</a>
          </td></tr>
          <tr><td style="padding:0 32px 28px;background:#ffffff;">
            <p style="margin:0;color:#5b667a;font-size:14px;line-height:1.7;">See you on the water.</p>
            <p style="margin:14px 0 0;color:#162033;font-size:14px;line-height:1.6;font-weight:800;">The Oceanid Team</p>
            <p style="margin:2px 0 0;color:#6c7588;font-size:13px;"><a href="mailto:contact@oceanid.io" style="color:#3949ab;text-decoration:none;">contact@oceanid.io</a></p>
          </td></tr>
          <tr><td style="padding:18px 32px;background:#f5f8fc;border-top:1px solid #e5edf6;">
            <p style="margin:0;color:#6c7588;font-size:12px;line-height:1.6;">You received this email because you claimed a founding-member reward at <a href="${accountUrl}" style="color:#3949ab;text-decoration:none;">oceanid.io/account</a>.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed' })

  try {
    const user = await verifyAuth0(req)

    const body = await req.json().catch(() => ({}))
    const rewardCode = String(body?.reward_code || '') as RewardCode
    if (!(rewardCode in REWARDS)) {
      return jsonResponse(400, { ok: false, error: 'Invalid reward_code' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Require a linked waitlist_links row.
    const { data: link, error: linkErr } = await supabase
      .from('waitlist_links')
      .select('waitlist_id')
      .eq('linked_auth0_sub', user.sub)
      .maybeSingle()
    if (linkErr) throw new Error(`waitlist_links lookup: ${linkErr.message}`)
    if (!link) {
      return jsonResponse(403, { ok: false, error: 'Not on the founding waitlist' })
    }

    const { data: wlRow, error: wlErr } = await supabase
      .from('waitlist')
      .select('id, name, email')
      .eq('id', link.waitlist_id)
      .maybeSingle()
    if (wlErr) throw new Error(`waitlist lookup: ${wlErr.message}`)
    if (!wlRow) {
      return jsonResponse(403, { ok: false, error: 'Waitlist row not found' })
    }

    // Idempotent: return existing claim if any.
    const { data: existing } = await supabase
      .from('reward_claims')
      .select('id, reward_code, promo_code, status, expires_at, claimed_at')
      .eq('auth0_sub', user.sub)
      .maybeSingle()
    if (existing) {
      return jsonResponse(200, { ok: true, already: true, reward_claim: existing })
    }

    const promoCode = generatePromoCode()
    const { data: inserted, error: insErr } = await supabase
      .from('reward_claims')
      .insert({
        auth0_sub: user.sub,
        email: user.email,
        waitlist_id: wlRow.id,
        reward_code: rewardCode,
        promo_code: promoCode,
        status: 'EMAILED',
      })
      .select('id, reward_code, promo_code, status, expires_at, claimed_at')
      .single()
    if (insErr) throw new Error(`reward_claims insert: ${insErr.message}`)

    try {
      const smtp = new SMTPClient({
        connection: {
          hostname: 'smtp.ionos.com',
          port: 465,
          tls: true,
          auth: {
            username: Deno.env.get('SMTP_USER')!,
            password: Deno.env.get('SMTP_PASS')!,
          },
        },
      })
      await smtp.send({
        from: '"Oceanid" <contact@oceanid.io>',
        to: user.email,
        subject: 'Your Oceanid founding reward is locked in',
        html: buildActivationHtml(wlRow.name || user.name || 'there', rewardCode, promoCode),
      })
      await smtp.close()
    } catch (mailErr) {
      console.error('activation email failed:', mailErr)
    }

    return jsonResponse(200, { ok: true, reward_claim: inserted })
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse(err.status, { ok: false, error: err.message })
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse(500, { ok: false, error: message })
  }
})
