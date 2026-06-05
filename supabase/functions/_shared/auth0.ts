// Auth0 ID-token verification for Supabase edge functions.
//
// The client sends the id_token as `Authorization: Bearer <jwt>`.
// We verify it against Auth0's JWKS, checking issuer + audience.
// Audience must equal the SPA Client ID (id_token audience claim).

import * as jose from 'https://deno.land/x/jose@v5.9.6/index.ts'

const AUTH0_DOMAIN = Deno.env.get('AUTH0_DOMAIN') ?? ''
const AUTH0_CLIENT_ID = Deno.env.get('AUTH0_CLIENT_ID') ?? ''

if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
  console.warn('[auth0] AUTH0_DOMAIN or AUTH0_CLIENT_ID not set — JWT verification will fail')
}

const ISSUER = `https://${AUTH0_DOMAIN}/`
const JWKS = jose.createRemoteJWKSet(
  new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`),
)

export interface Auth0User {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export async function verifyAuth0(req: Request): Promise<Auth0User> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new HttpError(401, 'Missing bearer token')

  let payload: jose.JWTPayload
  try {
    const verified = await jose.jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUTH0_CLIENT_ID,
    })
    payload = verified.payload
  } catch (err) {
    throw new HttpError(401, `Invalid token: ${(err as Error).message}`)
  }

  const sub = String(payload.sub || '')
  const email = String((payload as Record<string, unknown>).email || '').toLowerCase()
  if (!sub) throw new HttpError(401, 'Token missing sub claim')
  if (!email) throw new HttpError(401, 'Token missing email claim')

  return {
    sub,
    email,
    email_verified: Boolean((payload as Record<string, unknown>).email_verified),
    name: (payload as Record<string, unknown>).name as string | undefined,
    picture: (payload as Record<string, unknown>).picture as string | undefined,
  }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
