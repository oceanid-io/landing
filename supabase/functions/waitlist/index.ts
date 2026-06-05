import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.2.0/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

const links = {
  site: 'https://oceanid.io/',
  account: 'https://oceanid.io/account',
  logo: 'https://storage.googleapis.com/oceanid-public/logo.png',
  logoText: 'https://storage.googleapis.com/oceanid-public/logo-text.png',
  hero: 'https://storage.googleapis.com/oceanid-public/background.jpg',
  indiegogo: 'https://www.indiegogo.com/projects/oceanid/oceanid-one-app-for-life-at-sea',
  facebookPage: 'https://www.facebook.com/OceanidSeaLife',
  facebookGroup: 'https://www.facebook.com/groups/oceanid',
  instagram: 'https://www.instagram.com/oceanidsealife/',
  discord: 'https://discord.gg/caUTTgQFMa',
  youtube: 'https://www.youtube.com/@oceanid-sea-life',
}

function cleanHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildWelcomeHtml(name: string, role: string, claimToken: string) {
  const claimUrl = `${links.account}?token=${encodeURIComponent(claimToken)}`
  const roleCopy = role ? ` as <strong>${escapeHtml(role)}</strong>` : ''

  const rewardCard = (icon: string, title: string, body: string) => `
                    <tr>
                      <td style="padding:14px 16px;background:#ffffff;border:1px solid #dce6f2;border-radius:12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td width="40" valign="top" style="padding-right:12px;">
                              <div style="width:36px;height:36px;border-radius:10px;background:#eef0fb;color:#3949ab;font-size:18px;font-weight:800;text-align:center;line-height:36px;">${icon}</div>
                            </td>
                            <td>
                              <p style="margin:0 0 4px;color:#162033;font-size:15px;font-weight:800;line-height:1.3;">${title}</p>
                              <p style="margin:0;color:#5b667a;font-size:13px;line-height:1.55;">${body}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Welcome to Oceanid</title>
  </head>
  <body style="margin:0;padding:0;background:#eef4fb;color:#162033;font-family:Manrope,Inter,Segoe UI,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your founding reward is reserved. Sign in to oceanid.io/account to claim it.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4fb;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dce6f2;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(22,32,51,.12);">
            <tr>
              <td style="padding:22px 26px;background:#ffffff;border-bottom:1px solid #e5edf6;">
                <a href="${links.site}" style="display:inline-flex;align-items:center;text-decoration:none;">
                  <img src="${links.logo}" width="34" height="34" alt="Oceanid" style="display:inline-block;vertical-align:middle;border:0;margin-right:10px;">
                  <img src="${links.logoText}" height="22" alt="Oceanid" style="display:inline-block;vertical-align:middle;border:0;max-width:150px;">
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 32px 18px;background:#ffffff;">
                <p style="margin:0 0 10px;color:#5c6bc0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Your founding reward is reserved</p>
                <h1 style="margin:0 0 16px;color:#162033;font-size:34px;line-height:1.14;font-weight:800;letter-spacing:0;">Welcome aboard, ${escapeHtml(name)}.</h1>
                <p style="margin:0;color:#39445a;font-size:17px;line-height:1.6;">Thank you for registering${roleCopy}. As a founding member, you get to pick one of these rewards — free for 3 months.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 4px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${rewardCard('★', '3 months of Oceanid PRO — free', 'For captains and fleet managers. Unlimited vessels and unlimited paid trips on the PRO plan, free for 3 months (€60 value).')}
                  ${rewardCard('%', '0% platform commission for 3 months', 'For captains, fleet managers and service providers. Keep 100% of what travelers pay you on every booking for 3 months.')}
                  ${rewardCard('⛵', 'No booking fees for 3 months', 'For travelers. The 5% Oceanid booking fee is waived on every trip you book in your first 3 months.')}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 4px;background:#ffffff;">
                <p style="margin:0 0 8px;color:#162033;font-size:16px;font-weight:800;">How to claim</p>
                <p style="margin:0 0 6px;color:#39445a;font-size:14px;line-height:1.7;">1. Tap the button below to open your Oceanid account.</p>
                <p style="margin:0 0 6px;color:#39445a;font-size:14px;line-height:1.7;">2. Sign in with Google, Microsoft, Apple, or email + password.</p>
                <p style="margin:0;color:#39445a;font-size:14px;line-height:1.7;">3. Choose your reward — we email your activation code instantly.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 32px 26px;background:#ffffff;">
                <a href="${claimUrl}" style="display:inline-block;background:#5c6bc0;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;line-height:1;padding:16px 28px;border-radius:12px;box-shadow:0 10px 22px rgba(92,107,192,.28);">Open your Oceanid account</a>
                <p style="margin:14px 0 0;color:#6c7588;font-size:12px;line-height:1.5;">Link valid for 30 days. If the button doesn't work, copy this URL:<br><span style="color:#3949ab;word-break:break-all;">${claimUrl}</span></p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:20px;background:#f5f8fc;border:1px solid #dce6f2;border-radius:14px;">
                      <p style="margin:0 0 8px;color:#162033;font-size:16px;font-weight:800;">Back the launch & meet the crew</p>
                      <p style="margin:0 0 16px;color:#5b667a;font-size:14px;line-height:1.6;">Help Oceanid set sail — back the campaign and follow build updates in the community.</p>
                      <a href="${links.indiegogo}" style="display:block;text-align:center;background:#ffffff;color:#3949ab;text-decoration:none;font-size:14px;font-weight:800;padding:13px 16px;border:1px solid #d8e0f0;border-radius:10px;margin:0 0 10px;">Back Oceanid on Indiegogo</a>
                      <a href="${links.facebookGroup}" style="display:block;text-align:center;background:#ffffff;color:#3949ab;text-decoration:none;font-size:14px;font-weight:800;padding:13px 16px;border:1px solid #d8e0f0;border-radius:10px;margin:0 0 10px;">Join the Facebook group</a>
                      <a href="${links.discord}" style="display:block;text-align:center;background:#ffffff;color:#3949ab;text-decoration:none;font-size:14px;font-weight:800;padding:13px 16px;border:1px solid #d8e0f0;border-radius:10px;margin:0 0 10px;">Join Discord</a>
                      <a href="${links.instagram}" style="display:block;text-align:center;background:#ffffff;color:#3949ab;text-decoration:none;font-size:14px;font-weight:800;padding:13px 16px;border:1px solid #d8e0f0;border-radius:10px;margin:0 0 10px;">Follow on Instagram</a>
                      <a href="${links.youtube}" style="display:block;text-align:center;background:#ffffff;color:#3949ab;text-decoration:none;font-size:14px;font-weight:800;padding:13px 16px;border:1px solid #d8e0f0;border-radius:10px;margin:0 0 10px;">Watch on YouTube</a>
                      <a href="${links.facebookPage}" style="display:block;text-align:center;background:#ffffff;color:#3949ab;text-decoration:none;font-size:14px;font-weight:800;padding:13px 16px;border:1px solid #d8e0f0;border-radius:10px;margin:0;">Follow the Facebook page</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;background:#ffffff;">
                <p style="margin:0;color:#5b667a;font-size:14px;line-height:1.7;">See you on the water.</p>
                <p style="margin:18px 0 0;color:#162033;font-size:14px;line-height:1.6;font-weight:800;">The Oceanid Team</p>
                <p style="margin:2px 0 0;color:#6c7588;font-size:13px;line-height:1.6;"><a href="mailto:contact@oceanid.io" style="color:#3949ab;text-decoration:none;">contact@oceanid.io</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#f5f8fc;border-top:1px solid #e5edf6;">
                <p style="margin:0;color:#6c7588;font-size:12px;line-height:1.6;">You received this email because you registered for Oceanid early access at <a href="${links.site}" style="color:#3949ab;text-decoration:none;">oceanid.io</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const fd = await req.formData()
    const name = cleanHeaderValue((fd.get('name') as string) || 'there')
    const email = cleanHeaderValue((fd.get('email') as string) || '')
    const phone = cleanHeaderValue((fd.get('phone') as string) ?? '')
    const role = titleCase(cleanHeaderValue((fd.get('role') as string) ?? ''))
    const source = (fd.get('_source') as string) ?? ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Insert the waitlist row (untouched schema).
    const { data: wlRow, error: wlErr } = await supabase
      .from('waitlist')
      .insert({ name, email, phone, role, source })
      .select('id')
      .single()
    if (wlErr) throw new Error(`waitlist insert: ${wlErr.message}`)

    // Create the side-table link so the new signup gets a claim_token.
    const { data: linkRow, error: linkErr } = await supabase
      .from('waitlist_links')
      .insert({ waitlist_id: wlRow.id })
      .select('claim_token')
      .single()
    if (linkErr) throw new Error(`waitlist_links insert: ${linkErr.message}`)

    const claimToken = linkRow?.claim_token as string
    if (!claimToken) throw new Error('claim_token missing from waitlist_links insert')

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
      to: email,
      subject: 'Your founding reward is reserved — claim it on Oceanid',
      html: buildWelcomeHtml(name, role, claimToken),
    })
    await smtp.close()

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
