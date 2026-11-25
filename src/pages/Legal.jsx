import { useState } from 'react'
import { useT } from '../i18n/index.jsx'
import { Card } from '../components/ui.jsx'
// Template texts, not legal advice: have them reviewed before launch.
const D = {
  terms: { en: ['Terms of Service', 'By using NEXUS you agree to these terms and the Marketplace Rules.', 'You must be able to form a binding agreement in your country. You are responsible for your account and everything posted from it.', 'We may remove content or suspend accounts that break the rules. The service is provided as is.'],
    zh: ['服务条款', '使用 NEXUS 即表示你同意本条款及市场规则。', '你须具备在所在地订立有效协议的能力，并对账号及其发布的一切内容负责。', '违反规则的内容可能被删除，账号可能被暂停。服务按现状提供。'],
    id: ['Ketentuan Layanan', 'Dengan menggunakan NEXUS, kamu menyetujui ketentuan ini dan Aturan Pasar.', 'Kamu harus cakap hukum untuk membuat perjanjian di negaramu dan bertanggung jawab atas akun serta semua kontennya.', 'Konten yang melanggar aturan dapat dihapus dan akun dapat ditangguhkan. Layanan disediakan apa adanya.'] },
  guidelines: { en: ['Community Guidelines', 'Be respectful. No harassment, hate, threats or spam.', 'Only post content you have the right to share. No illegal content.'],
    zh: ['社区准则', '互相尊重。禁止骚扰、仇恨、威胁和垃圾信息。', '只发布你有权分享的内容，禁止违法内容。'],
    id: ['Pedoman Komunitas', 'Saling menghormati. Dilarang melecehkan, menyebar kebencian, mengancam, atau spam.', 'Posting hanya konten yang berhak kamu bagikan. Dilarang konten ilegal.'] },
  privacy: { en: ['Privacy Policy', 'We store your username, profile details, posts, listings, messages and uploaded media to run the service. NEXUS never asks for your email address.', 'We do not sell your data and we do not collect payment information. Public profile content is visible to others.', 'You can permanently delete your account from Account & Privacy settings. Some records may be retained for security and legal reasons.'],
    zh: ['隐私政策', '为提供服务，我们保存你的用户名、资料、帖子、商品、消息和上传的媒体。NEXUS 不会要求你提供邮箱。', '我们不出售你的数据，也不收集支付信息。公开的资料内容对他人可见。', '你可以在账号与隐私设置中永久删除账号。出于安全和法律原因，部分记录可能会保留。'],
    id: ['Kebijakan Privasi', 'Kami menyimpan nama pengguna, data profil, posting, listing, pesan, dan media yang diunggah untuk menjalankan layanan. NEXUS tidak pernah meminta alamat email kamu.', 'Kami tidak menjual datamu dan tidak mengumpulkan informasi pembayaran. Konten profil publik dapat dilihat orang lain.', 'Kamu dapat meminta penghapusan akun dan data lewat administrator.'] },
  copyright: { en: ['Copyright Policy', 'LifeAfter and its trademarks, logos and game assets belong to their respective owners. NEXUS claims no ownership of them.', 'Do not upload content you do not have rights to. Send takedown requests to the administrators and we will review them.'],
    zh: ['版权政策', 'LifeAfter 及其商标、标志和游戏素材归各自权利人所有，NEXUS 不主张所有权。', '请勿上传你无权使用的内容。下架请求请发送给管理员，我们会审核。'],
    id: ['Kebijakan Hak Cipta', 'LifeAfter beserta merek dagang, logo, dan aset gamenya milik pemiliknya masing-masing. NEXUS tidak mengklaim kepemilikan.', 'Jangan unggah konten yang bukan hakmu. Kirim permintaan penghapusan ke administrator untuk ditinjau.'] },
  rules: { en: ['Marketplace Rules', 'Prohibited: scams, fake listings, misleading prices, impersonation, stolen accounts, phishing, fraudulent payments, illegal transactions, spam, harassment, manipulated reviews, and unauthorized copyrighted content.', 'NEXUS does not process or guarantee payments. Buyers and sellers arrange deals at their own risk. Always verify the other party and the details.'],
    zh: ['市场规则', '禁止：诈骗、虚假商品、误导性价格、冒充、被盗账号、钓鱼、欺诈支付、非法交易、垃圾信息、骚扰、刷评价以及未经授权的版权内容。', 'NEXUS 不处理也不担保付款。买卖双方自行安排交易并自担风险，请务必核实对方和交易细节。'],
    id: ['Aturan Pasar', 'Dilarang: penipuan, listing palsu, harga menyesatkan, peniruan identitas, akun curian, phishing, pembayaran curang, transaksi ilegal, spam, pelecehan, ulasan palsu, dan konten berhak cipta tanpa izin.', 'NEXUS tidak memproses atau menjamin pembayaran. Pembeli dan penjual bertransaksi atas risiko sendiri. Selalu verifikasi pihak lain dan detailnya.'] },
  moderation: { en: ['Moderation Policy', 'Moderators review reports and may remove listings or posts, suspend or ban accounts. Actions are logged.', 'Decisions can be questioned by contacting the administrators.'],
    zh: ['审核政策', '审核员会处理举报，可删除商品或帖子，暂停或封禁账号。所有操作均有记录。', '如对决定有异议，可联系管理员。'],
    id: ['Kebijakan Moderasi', 'Moderator meninjau laporan dan dapat menghapus listing atau posting, menangguhkan atau memblokir akun. Semua tindakan dicatat.', 'Keputusan dapat ditanyakan ke administrator.'] },
  deletion: { en: ['Account Deletion Policy', 'You may ask the administrators to delete your account. Your profile, listings, posts and uploaded media will be removed.', 'Some records, such as reports and moderation logs, may be kept to protect the community.'],
    zh: ['账号删除政策', '你可请求管理员删除账号，你的资料、商品、帖子和上传的媒体将被移除。', '举报和审核记录等部分信息可能为保护社区而保留。'],
    id: ['Kebijakan Penghapusan Akun', 'Kamu dapat meminta administrator menghapus akunmu. Profil, listing, posting, dan media yang diunggah akan dihapus.', 'Beberapa catatan, seperti laporan dan log moderasi, dapat disimpan untuk melindungi komunitas.'] },
}
const DISCLAIMER = {
  en: 'NEXUS is an independent, fan-made marketplace and gaming community. It is not affiliated with, endorsed by, sponsored by, or officially connected to NetEase Games or the operators of LifeAfter. LifeAfter and its trademarks, logos, game assets, characters and intellectual property belong to their respective owners.',
  zh: 'NEXUS 是独立的玩家自制市场与游戏社区，与网易游戏或 LifeAfter 运营方无任何关联，亦未获其认可、赞助或官方授权。LifeAfter 及其商标、标志、游戏素材、角色和知识产权归其各自所有者所有。',
  id: 'NEXUS adalah marketplace dan komunitas game buatan penggemar yang independen. NEXUS tidak berafiliasi, didukung, disponsori, atau terhubung secara resmi dengan NetEase Games atau operator LifeAfter. LifeAfter beserta merek dagang, logo, aset game, karakter, dan kekayaan intelektualnya milik pemiliknya masing-masing.',
}
export default function Legal() {
  const { lang } = useT()
  const [k, setK] = useState('terms'); const [title, ...paras] = (D[k][lang] || D[k].en)
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="noscroll flex gap-2 overflow-x-auto">{Object.keys(D).map((x) => <button key={x} onClick={() => setK(x)} className={`chip ${k === x ? 'on' : ''}`}>{(D[x][lang] || D[x].en)[0]}</button>)}</div>
      <Card hud className="space-y-3" key={k}>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {paras.map((p, i) => <p key={i} className="text-muted">{p}</p>)}
      </Card>
      <p className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-muted">{DISCLAIMER[lang] || DISCLAIMER.en}</p>
    </div>
  )
}
