// Supabase Auth verification helper for edge functions.
//
// The client sends the access token as `Authorization: Bearer <jwt>`.
// We verify it by calling `supabase.auth.getUser(token)` which validates
// the JWT against Supabase's signing key and returns the user record.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export interface AuthedUser {
  id: string
  email: string
  name?: string
  picture?: string
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
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

export async function verifyUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new HttpError(401, 'Missing bearer token')

  const supabase = serviceClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    throw new HttpError(401, error?.message || 'Invalid session')
  }

  const u = data.user
  const email = (u.email || '').toLowerCase()
  if (!email) throw new HttpError(401, 'Session missing email')

  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  return {
    id: u.id,
    email,
    name: (meta.full_name as string) || (meta.name as string) || u.email || undefined,
    picture: (meta.avatar_url as string) || (meta.picture as string) || undefined,
  }
}
