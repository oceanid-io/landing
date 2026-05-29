import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SmtpClient } from 'https://deno.land/x/smtp/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const fd = await req.formData()
  const name   = fd.get('name')    as string
  const email  = fd.get('email')   as string
  const phone  = (fd.get('phone')   as string) ?? ''
  const role   = (fd.get('role')    as string) ?? ''
  const source = (fd.get('_source') as string) ?? ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase.from('waitlist').insert({ name, email, phone, role, source })
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const smtp = new SmtpClient()
  await smtp.connectTLS({
    hostname: 'smtp.ionos.com',
    port: 465,
    username: Deno.env.get('SMTP_USER')!,
    password: Deno.env.get('SMTP_PASS')!,
  })
  await smtp.send({
    from: 'contact@oceanid.io',
    to: email,
    subject: "Welcome to Oceanid — you're on the list",
    content: `Hi ${name},\n\nThank you for joining the Oceanid early access list. We'll reach out as soon as we're ready to welcome you aboard.\n\nThe Oceanid Team\ncontact@oceanid.io`,
  })
  await smtp.close()

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
