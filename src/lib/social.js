import { supabase } from './supabase.js'

const PROFILE_MIN = 'id,username,display_name,avatar_url'

// Follow / friend state between me and a list of other people → { [id]: {following, friend, request, requestId} }
export async function fetchRelations(me, ids) {
  const out = {}
  ids.forEach((id) => { out[id] = { following: false, friend: false, request: null, requestId: null } })
  if (!ids.length) return out
  const [f, r] = await Promise.all([
    supabase.from('follows').select('followee_id').eq('follower_id', me).in('followee_id', ids),
    supabase.from('friend_requests').select('id,requester_id,recipient_id,status')
      .or(`requester_id.eq.${me},recipient_id.eq.${me}`)
      .in('status', ['pending', 'accepted'])
      .in('requester_id', [me, ...ids]).in('recipient_id', [me, ...ids]),
  ])
  ;(f.data || []).forEach((x) => { if (out[x.followee_id]) out[x.followee_id].following = true })
  ;(r.data || []).forEach((x) => {
    const other = x.requester_id === me ? x.recipient_id : x.requester_id
    if (!out[other]) return
    out[other].requestId = x.id
    if (x.status === 'accepted') out[other].friend = true
    else out[other].request = x.requester_id === me ? 'sent' : 'received'
  })
  return out
}

export async function toggleFollow(me, otherId, rel) {
  return rel?.following
    ? supabase.from('follows').delete().eq('follower_id', me).eq('followee_id', otherId)
    : supabase.from('follows').insert({ follower_id: me, followee_id: otherId })
}

// One button, four meanings: add → cancel → accept → unfriend
export async function friendAction(me, otherId, rel) {
  if (rel?.request === 'sent') return supabase.from('friend_requests').update({ status: 'cancelled' }).eq('id', rel.requestId)
  if (rel?.request === 'received') return supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', rel.requestId)
  if (rel?.friend) return supabase.from('friend_requests').delete().eq('id', rel.requestId)
  return supabase.from('friend_requests').insert({ requester_id: me, recipient_id: otherId })
}

// Accepted friends of a user, as plain profiles.
export async function loadFriends(uid, limit = 60) {
  const { data } = await supabase.from('friend_requests')
    .select(`id,requester_id,recipient_id,requester:profiles!friend_requests_requester_id_fkey(${PROFILE_MIN}),recipient:profiles!friend_requests_recipient_id_fkey(${PROFILE_MIN})`)
    .eq('status', 'accepted').or(`requester_id.eq.${uid},recipient_id.eq.${uid}`).limit(limit)
  return (data || [])
    .map((x) => ({ requestId: x.id, profile: x.requester_id === uid ? x.recipient : x.requester }))
    .filter((x) => x.profile)
}

export const PROFILE_FIELDS = PROFILE_MIN
