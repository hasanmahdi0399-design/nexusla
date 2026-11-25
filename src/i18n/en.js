export default {
  // navigation
  home: 'Home', market: 'Trading Post', people: 'Survivors', friends: 'Friends', messages: 'Messages', notifications: 'Notifications',
  settings: 'Settings', admin: 'Admin', legal: 'Legal', me: 'Me', my_profile: 'My profile', back: 'Back', contacts: 'Contacts', see_all: 'See all',
  disclaimer_short: 'Independent fan-made platform. Not affiliated with NetEase Games or LifeAfter.',
  search: 'Search the Trading Post…', search_survivors: 'Search survivors…', search_chats: 'Search chats…',
  // auth
  login: 'Log in', signup: 'Sign up', logout: 'Log out', username: 'Username', password: 'Password', confirm_password: 'Confirm password',
  display_name: 'Display name', optional: 'optional', show: 'Show', hide: 'Hide',
  have_account: 'Already a survivor? Log in', need_account: 'New here? Create an account',
  hero_1: 'Survive the Mist.', hero_2: 'Trade. Connect. Rebuild.',
  hero_sub: 'The fan-made home for LifeAfter survivors. Find gear, sell your loot, meet other players and message them privately.',
  feat_1: 'Username + password only: no email needed', feat_2: 'Your own profile with photo and banner', feat_3: 'Private 1-to-1 messages with other survivors',
  no_recovery: 'There is no email, so passwords cannot be recovered. Keep yours safe.',
  err_username: 'Username must be 3–24 characters: letters, numbers or underscore.', err_password_short: 'Password must be at least 6 characters.',
  err_password_match: 'Passwords do not match.', err_login: 'Wrong username or password.', err_taken: 'That username is already taken.',
  err_confirm_on: 'Account created, but the server still wants email confirmation. The admin must turn off “Confirm email” in Supabase.',
  err_img_type: 'Please choose a JPG, PNG, WEBP or GIF image.', err_img_big: 'That image is too large (max 5 MB).',
  err_denied: 'You are not allowed to do that.', err_network: 'Network problem. Check your connection.', err_title: 'Title needs at least 3 characters.',
  account_restricted: 'Your account is restricted. You can read but not post.',
  // generic
  save: 'Save', saved: 'Saved', cancel: 'Cancel', delete: 'Delete', send: 'Send', share: 'Share', accept: 'Accept', decline: 'Decline',
  load_more: 'Load more', nothing_found: 'Nothing found.', copied: 'Copied', all: 'All', system: 'NEXUS', you: 'You', photo: 'Photo', publish: 'Publish',
  report: 'Report', reportReason: 'Why are you reporting this?', report_sent: 'Report sent. Thank you.',
  // feed
  feed_all: 'Everyone', feed_following: 'Following', whatsup: "What's on your mind, {name}?", post: 'Post',
  like: 'Like', comment: 'Comment', reply: 'Reply', replyingTo: 'Replying to {name}', writeComment: 'Write a comment…', n_comments: '{n} comments',
  confirm_delete_post: 'Delete this post?', empty_feed: 'The wasteland is quiet. Be the first to post!', empty_following: 'Follow some survivors to see their posts here.',
  add_story: 'Add story', your_story: 'Your story', pick_photo: 'Tap to choose a photo', change_photo: 'Change photo', caption_optional: 'Caption (optional)',
  story_hint: 'Stories disappear after 24 hours.', story_shared: 'Story shared!', no_friends_yet: 'No friends yet.',
  // profile
  edit_profile: 'Edit profile', add_banner: 'Add banner', change_banner: 'Change banner', bio: 'Bio', game_nick: 'LifeAfter nickname', server: 'Server', camp: 'Camp',
  profile_visibility: 'Profile visibility', public: 'Public', private: 'Private', user_code: 'NEXUS ID', joined: 'Joined {date}', joined_label: 'Joined',
  followers: 'followers', following: 'following', follow: 'Follow', unfollow: 'Unfollow', message: 'Message', add_friend: 'Add friend', friends_status: 'Friends',
  cancel_request: 'Cancel request', block: 'Block', unblock: 'Unblock', blocked_done: 'User blocked.', unblocked: 'User unblocked.',
  tab_posts: 'Posts', tab_about: 'About', tab_friends: 'Friends', empty_mine: 'You have not posted yet. Say something!', empty_theirs: 'No posts yet.',
  profile_unavailable: 'This survivor cannot be found, or their profile is private.', photo_hint: 'Change your profile photo and banner with the camera buttons on your profile. GIFs stay animated.',
  // people / friends
  people_sub: 'Find players by username or NEXUS ID.', new_survivors: 'New survivors', lifeafter_player: 'LifeAfter player',
  requests: 'Friend requests', your_friends: 'Your friends', sent_requests: 'Sent requests', unfriend: 'Unfriend', confirm_unfriend: 'Remove this friend?',
  find_survivors: 'Find survivors',
  // messages
  new_message: 'New message', no_chats: 'No conversations yet.', select_chat: 'Select a conversation or start a new one.', user_not_found: 'That user could not be found.',
  dm_private: 'Private chat. Only the two of you can read it.', type_message: 'Type a message…', seen: 'Seen', say_hi: 'Say hi to {name}!', view_profile: 'View profile',
  you_blocked: 'You blocked this user.', cant_message: 'You cannot message this user.',
  // notifications
  markAll: 'Mark all read', empty_notifications: 'No notifications yet.',
  n_reaction: 'liked your post', n_comment: 'commented on your post', n_follow: 'started following you', n_message: 'sent you a message',
  n_friend_request: 'sent you a friend request', n_friend_accepted: 'accepted your friend request', n_listing_inquiry: 'asked about your listing', n_system: 'sent an update',
  // market
  market_sub: 'Buy, sell and trade LifeAfter items.', new_listing: 'New listing', title: 'Title', desc: 'Description', price: 'Price', category: 'Category', all_categories: 'All categories',
  sale: 'For sale', wanted: 'Wanted', trade: 'Trade', giveaway: 'Giveaway', contact: 'Contact seller', sold: 'Mark sold', add_photos: 'Add photos', up_to_5: 'Up to 5 photos',
  n_photos: '{n} photo(s) selected', listing_posted: 'Listing published!', confirm_delete_listing: 'Delete this listing?', empty_market: 'No listings match. Try another search.',
  status_sold: 'Sold', status_reserved: 'Reserved', status_unavailable: 'Unavailable', status_removed: 'Removed',
  safety: 'Verify sellers and transaction details. NEXUS does not handle or guarantee payments.',
  seller_reviews: 'Seller reviews', no_reviews: 'No reviews yet.', review_placeholder: 'Share your experience with this seller', submit_review: 'Submit review',
  review_posted: 'Review posted.', review_dup: 'You already reviewed this seller.', review_need_dm: 'You can review a seller after you have messaged each other.',
  // settings
  account: 'Account', signed_in_as: 'Signed in as', language: 'Language', visibility_help: 'Private profiles are hidden from search and from other survivors.',
  change_password: 'Change password', current_password: 'Current password', new_password: 'New password', update_password: 'Update password',
  err_cur_password: 'Your current password is wrong.', password_changed: 'Password updated.', blocked_users: 'Blocked users', no_blocked: 'You have not blocked anyone.',
  delete_account: 'Delete account', delete_help: 'Permanently deletes your account, posts, messages and uploaded media. This cannot be undone.', delete_account_btn: 'Permanently delete my account',
  confirm_delete_1: 'Permanently delete your NEXUS account? This cannot be undone.', confirm_delete_2: 'Final confirmation: delete your account now?', delete_failed: 'Account deletion failed:',
}
