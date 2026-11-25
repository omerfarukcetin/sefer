/* Sefer bulut ayarları: Emanet ile aynı Supabase projesi.
   anon (publishable) anahtar herkese açık olacak şekilde tasarlanmıştır; verileri satır güvenliği (RLS) korur. */
window.SEFER_CONFIG = {
  supabaseUrl: "https://clwgjupnigenndbbkcnk.supabase.co",
  supabaseKey: "sb_publishable_ankAPHs2d9ja8bJNIL8sIA_L8O4jVNq",
  /* Bildirimler için açık anahtar. Gizli eşi yalnızca Supabase → Edge Functions → Secrets içinde (SEFER_VAPID_PRIVATE) durur. */
  vapidPublicKey: "BHIZgXXhrdEgjFS9DfodHE-mAVaV1gT_daLvt827EpiszY8M4GkiopSDjjgaaB-5vPACGFM89gYd3QLqSlmCZag"
};
