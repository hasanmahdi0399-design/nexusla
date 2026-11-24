// Deploy with: supabase functions deploy delete-account
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Edge Function secrets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const tokenClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  })
  const { data: { user }, error } = await tokenClient.auth.getUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // Remove the user's public media folder before deleting the auth identity.
  const { data: files } = await admin.storage.from('media').list(user.id, { limit: 1000 })
  if (files?.length) await admin.storage.from('media').remove(files.map((f) => `${user.id}/${f.name}`))
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 400 })
  return Response.json({ success: true })
})
