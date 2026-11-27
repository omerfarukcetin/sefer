/* ================= DİL REHBERİ (İngilizce, A1 → C2) =================
   Sefer'in ana betiğinden ÖNCE yüklenir; buradaki işlevler ana betikteki S, save, render, modal, $, esc,
   dk, ico, toast, completeTask gibi işlevleri çağrıldıkları anda kullanır.
   Veri: S.lang = { lvl, tp:{konu:dersSayısı}, words:[kart], les:{gün:ders}, cur:{k,step,...}, hist:[...] }
   İçerik Gemini ile üretilir; anahtar Satır İzi'nin aynı tarayıcıda sakladığı anahtardır (localStorage 'satir-key').
   Kelime tekrarı (aralıklı tekrar) anahtarsız da çalışır. */

const DIL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DIL_PER_TOPIC = 3; // bir konu üç derste tamamlanır: temel, alıştırma, kullanım
const DIL_SYL = {
  A1: ['To be ve şahıs zamirleri', 'Geniş zaman (present simple)', 'There is / there are', 'A / an / the', 'Çoğullar, sayılabilen isimler', 'İyelik: my, your, \'s', 'Can / can\'t', 'Şimdiki zaman (present continuous)', 'Was / were', 'Düzenli fiillerle geçmiş zaman', 'Yer ve zaman edatları (in, on, at)', 'Soru kelimeleri'],
  A2: ['Düzensiz fiillerle geçmiş zaman', 'Past continuous', 'Gelecek: going to ve will', 'Karşılaştırma ve üstünlük', 'Sıklık zarfları', 'Present perfect (ever / never / just)', 'Should, must, have to', 'Some, any, much, many', 'Gerund ve infinitive temelleri', 'Birinci koşul cümleleri', 'Bağlaçlar: because, so, but, although', 'Günlük durumlar: alışveriş, yol tarifi, randevu'],
  B1: ['Present perfect ile past simple farkı', 'Present perfect continuous', 'Past perfect', 'İkinci koşul cümleleri', 'Edilgen yapı (passive)', 'Dolaylı anlatım (reported speech)', 'Sıfat cümlecikleri (who, which, that)', 'Used to ve would', 'Tahmin bildiren kipler (must, might, can\'t)', 'Sık kullanılan phrasal verb\'ler', 'Too / enough, so / such', 'Fikir bildirme ve tartışma kalıpları'],
  B2: ['Üçüncü ve karışık koşul cümleleri', 'İleri edilgen yapılar', 'Wish ve if only', 'Geçmişe dönük kipler (should have, might have)', 'Ettirgen: have / get something done', 'Devrik yapılar (temel)', 'Ortaç cümlecikleri (participle clauses)', 'Söylem belirleyiciler (however, therefore…)', 'Eşdizimler (collocations)', 'Anlatı zamanları', 'Resmî ve gündelik dil', 'Görüş yazısı (opinion essay) yapısı'],
  C1: ['İleri devrik yapılar', 'Vurgu cümleleri (cleft sentences)', 'Subjunctive', 'İsimleştirme (nominalisation)', 'Temkinli dil (hedging)', 'Eksiltme ve yerine koyma', 'Deyimler ve ileri eşdizimler', 'Karmaşık isim öbekleri', 'Akademik yazı kalıpları', 'Kiplerde ince anlam farkları', 'Metin bütünlüğü (cohesion)', 'Üslup ve ton'],
  C2: ['Mecazlı ve deyimsel dil', 'Üslup araçları', 'Kesin ve ince kelime seçimi', 'Karmaşık argüman kurma', 'İnce anlam farklarını dinleme', 'Yeniden yazma ve özetleme', 'Edebî metinler', 'Kültürel göndermeler', 'Retorik', 'Düzelti ve son okuma']
};
const DIL_RES = {
  A1: ['BBC Learning English: başlangıç düzeyi kısa videolar', 'Kolaylaştırılmış kitaplar (Oxford Bookworms, Penguin Readers) başlangıç düzeyi', 'Telefonunun dilini bir süre İngilizce yap'],
  A2: ['BBC Learning English: 6 Minute English', 'VOA Learning English: yavaş okunan haberler', 'Kolaylaştırılmış kitaplar 1-2. düzey'],
  B1: ['BBC 6 Minute English ve VOA haberleri altyazısız', 'TED-Ed kısa videoları İngilizce altyazıyla', 'Kolaylaştırılmış kitaplar 3-4. düzey'],
  B2: ['İlgi alanında İngilizce podcastler ve YouTube kanalları', 'TED konuşmaları İngilizce altyazıyla', 'Kısaltılmamış kısa romanlar'],
  C1: ['Haber siteleri ve köşe yazıları (BBC, The Guardian)', 'Altyazısız dizi ve belgeseller', 'Alanında İngilizce kitap ve makaleler'],
  C2: ['Edebî eserler ve deneme kitapları', 'Tartışma programları ve uzun söyleşiler', 'İngilizce yazı yazıp düzeltme aldırma']
};

const dilOn = () => !!(S.lang && S.lang.lvl);
const dilKey = () => { try { return localStorage.getItem('satir-key') || ''; } catch (e) { return ''; } };
const dilLvl = () => S.lang.lvl;
const dilTopics = () => DIL_SYL[dilLvl()] || [];
const dilTp = t => (S.lang.tp || {})[dilLvl() + '|' + t] || 0;
const dilDoneTopics = () => dilTopics().filter(t => dilTp(t) >= DIL_PER_TOPIC).length;
const dilNextTopic = () => dilTopics().find(t => dilTp(t) < DIL_PER_TOPIC) || null;
const dilTask = () => S.tasks.find(t => t.type === 'lang');
const dilDue = () => (S.lang.words || []).filter(w => (w.due || '') <= dk());
let DIL = { busy: '', err: '', reveal: false, sel: null, fb: null, test: null };

/* ---------- Gemini ---------- */
async function dilAI(prompt, maxTokens = 4000) {
  const key = dilKey(); if (!key) throw new Error('no_key');
  const models = [S.lang.model, 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter((m, i, a) => m && a.indexOf(m) === i);
  let last = null;
  for (const m of models) {
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, cache: 'no-store',
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: maxTokens } })
      });
    } catch (e) { throw new Error('network'); }
    if (res.status === 404 || res.status === 400) { last = 'model'; continue; }
    if (res.status === 401 || res.status === 403) throw new Error('key');
    if (res.status === 429) throw new Error('quota');
    if (!res.ok) { last = 'http'; continue; }
    const data = await res.json();
    const text = ((data.candidates || [])[0]?.content?.parts || []).filter(p => !p.thought && p.text).map(p => p.text).join('');
    try { const j = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); if (S.lang.model !== m) { S.lang.model = m; } return j; }
    catch (e) { last = 'json'; continue; }
  }
  throw new Error(last || 'http');
}
function dilErrText(e) {
  const m = e && e.message;
  return m === 'no_key' ? 'Gemini anahtarı bulunamadı. Kitaplar sekmesinde Satır İzi → Ayarlar\'dan anahtarını gir; bu cihazda hatırlanması seçili olmalı.'
    : m === 'key' ? 'Gemini anahtarı geçersiz görünüyor. Satır İzi ayarlarından kontrol et.'
    : m === 'quota' ? 'Gemini\'nin günlük ücretsiz kotası doldu. Bir süre sonra tekrar dene; bu arada kelime tekrarı yapabilirsin.'
    : m === 'network' ? 'İnternete bağlanılamadı. Bağlantı gelince tekrar dene.'
    : 'Ders hazırlanamadı. Tekrar dene.';
}

/* ---------- aralıklı tekrar ---------- */
function dilAddWords(list) {
  const W = S.lang.words = S.lang.words || [], have = new Set(W.map(w => w.w.toLowerCase()));
  (list || []).forEach(x => { if (!x || !x.w || have.has(String(x.w).toLowerCase())) return; have.add(String(x.w).toLowerCase());
    W.push({ w: String(x.w).slice(0, 60), tr: String(x.tr || '').slice(0, 80), ex: String(x.ex || '').slice(0, 160), lvl: dilLvl(), due: dk(), ivl: 0, reps: 0, add: dk() }); });
}
function dilGrade(w, ok) {
  if (ok) { w.reps = (w.reps || 0) + 1; w.ivl = w.reps === 1 ? 1 : w.reps === 2 ? 3 : Math.round((w.ivl || 3) * 2.3); w.due = addDays(dk(), w.ivl); }
  else { w.reps = 0; w.ivl = 0; w.due = addDays(dk(), 1); }
}
function dilSpeak(t) { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'en-GB'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast('Bu cihaz sesli okumayı desteklemiyor.'); } }
const dilSay = t => `<button class="dsay" data-act="dsay" data-id="${esc(t)}" aria-label="Sesli oku">${ico('sound')}</button>`;

/* ---------- ders üretimi ---------- */
async function dilMakeLesson() {
  const topic = dilNextTopic(); if (!topic) return null;
  const n = dilTp(topic) + 1, focus = n === 1 ? 'konunun temeli, en sık kullanılan kalıplar' : n === 2 ? 'alıştırma ağırlıklı, farklı örnekler' : 'günlük hayatta kullanım ve sık yapılan hatalar';
  const known = (S.lang.words || []).slice(-150).map(w => w.w).join(', ');
  const p = `Sen Türkçe konuşan bir öğrenciye İngilizce öğreten deneyimli bir öğretmensin. Öğrencinin seviyesi CEFR ${dilLvl()}. Günde 15 dakika çalışıyor.
Bugünkü konu: "${topic}" (bu konunun ${n}. dersi, odak: ${focus}).
Öğrencinin zaten bildiği kelimeler (bunları yeni kelime olarak verme): ${known || 'yok'}.
Yalnızca şu JSON'u döndür:
{"topic":"konu adı (Türkçe)","explain":"Türkçe, sade, en fazla 110 kelimelik anlatım","examples":[{"en":"","tr":""}] (4 örnek),
"practice":[{"q":"boşluklu ya da seçmeli İngilizce soru","options":["","","",""],"answer":0,"why":"Türkçe kısa açıklama"}] (3 soru),
"words":[{"w":"İngilizce kelime ya da kalıp","tr":"Türkçe anlamı","ex":"seviyeye uygun kısa İngilizce örnek cümle"}] (6 kelime, ${dilLvl()} seviyesine uygun, konuyla ya da günlük hayatla ilgili),
"reading":{"title":"","text":"${dilLvl()} seviyesine uygun, bugünkü konuyu ve yeni kelimeleri kullanan ${({ A1: 60, A2: 90, B1: 130, B2: 170, C1: 210, C2: 250 })[dilLvl()]} kelimelik İngilizce metin","questions":[{"q":"İngilizce anlama sorusu","options":["","","",""],"answer":0}] (3 soru)},
"writing":"Türkçe yönerge: bugünkü konuyu kullanarak 2-3 İngilizce cümle yazdıran kısa bir görev"}
"answer" doğru seçeneğin sıra numarasıdır (0'dan başlar). Doğru cevapların yeri soruya göre değişsin.`;
  const j = await dilAI(p);
  if (!j || !j.explain || !Array.isArray(j.practice) || !j.reading) throw new Error('json');
  return { ...j, k: dk(), topic, n };
}

/* ---------- akış ---------- */
const DIL_STEPS = [['review', 'Kelime tekrarı'], ['words', 'Yeni kelimeler'], ['grammar', 'Konu'], ['reading', 'Okuma'], ['writing', 'Yazma']];
function dilCur() { const c = S.lang.cur; return c && c.k === dk() ? c : null; }
async function dilStart() {
  if (DIL.busy) return;
  let c = dilCur();
  if (!c) {
    const les = (S.lang.les || {})[dk()];
    if (!les && dilNextTopic()) {
      DIL.busy = 'Bugünkü ders hazırlanıyor…'; DIL.err = ''; render();
      try { const L = await dilMakeLesson(); S.lang.les = { ...(S.lang.les || {}), [dk()]: L };
        const keep = Object.keys(S.lang.les).sort().slice(-10); S.lang.les = Object.fromEntries(keep.map(k => [k, S.lang.les[k]])); }
      catch (e) { DIL.busy = ''; DIL.err = dilErrText(e); if (e.message === 'no_key' || e.message === 'quota' || e.message === 'network') { S.lang.cur = { k: dk(), step: 'review', i: 0, offline: true }; save(); } render(); return; }
      DIL.busy = '';
    }
    S.lang.cur = { k: dk(), step: 'review', i: 0 }; save();
  }
  if (S.lang.cur && S.lang.cur.paused) { delete S.lang.cur.paused; save(); }
  DIL.reveal = false; DIL.sel = null; DIL.fb = null; tab = 'dil'; render(); window.scrollTo(0, 0);
}
function dilNext() {
  const c = dilCur(); if (!c) return; const L = (S.lang.les || {})[dk()];
  const order = DIL_STEPS.map(s => s[0]).filter(s => s === 'review' || (L && !c.offline));
  const i = order.indexOf(c.step);
  c.i = 0; DIL.reveal = false; DIL.sel = null; DIL.fb = null;
  if (i < order.length - 1) { c.step = order[i + 1]; save(); render(); window.scrollTo(0, 0); return; }
  dilFinish();
}
function dilFinish() {
  const c = dilCur(), L = (S.lang.les || {})[dk()];
  if (L && !c.offline && !c.done) { const key = dilLvl() + '|' + L.topic; S.lang.tp = { ...(S.lang.tp || {}), [key]: Math.max(dilTp(L.topic), L.n) }; }
  c.done = true; c.step = 'done'; save();
  const t = dilTask(); if (t && !isDone(t, dk())) completeTask(t.id, 15); else render();
  window.scrollTo(0, 0);
}

/* ---------- görünüm ---------- */
function vDil() {
  if (!dilOn()) return dilSetup();
  if (DIL.extra) return `<div class="dil">${dilLesson({ k: dk(), step: 'review', extra: true })}</div>`;
  const c = dilCur();
  if (c && c.step !== 'done' && !c.paused) return `<div class="dil">${dilLesson(c)}</div>`;
  const lv = dilLvl(), tops = dilTopics(), dn = dilDoneTopics(), due = dilDue().length, W = (S.lang.words || []).length, nx = dilNextTopic();
  const pct = Math.round(tops.length ? (tops.reduce((a, t) => a + Math.min(DIL_PER_TOPIC, dilTp(t)), 0) / (tops.length * DIL_PER_TOPIC)) * 100 : 0);
  const today = c && c.step === 'done';
  return `<div class="dil"><header class="phead"><h1>İngilizce</h1><p>Günde 15 dakika: kelime tekrarı, bir konu, kısa bir okuma ve yazma.</p></header>
    <div class="panel dlev"><div class="dlvbadge">${lv}</div><div class="dlvtx"><b>${lv} seviyesi</b><small>${dn} / ${tops.length} konu tamam${nx ? `, sıradaki: ${esc(nx)}` : ''}</small><span class="mbar"><i style="width:${pct}%;background:var(--turq)"></i></span></div></div>
    ${DIL.busy ? `<div class="panel"><p>${esc(DIL.busy)}</p></div>` : ''}
    ${DIL.err ? `<div class="panel excuse warn"><p>${esc(DIL.err)}</p></div>` : ''}
    <button class="panel dtoday ${today ? 'ok' : ''}" data-act="dstart" ${DIL.busy ? 'disabled' : ''}>
      <b>${today ? 'Bugünkü ders tamam' : c ? 'Bugünkü derse devam et' : 'Bugünkü dersi başlat'}</b>
      <small>${today ? 'Yarın yeni bir ders seni bekliyor. İstersen kelimeleri tekrar edebilirsin.' : nx ? `${esc(nx)} · ${dilTp(nx) + 1}. ders` : 'Bu seviyenin bütün konuları bitti. Seviye sınavına girebilirsin.'}</small></button>
    <div class="panel"><div class="between"><h3 style="margin:0">Kelime kutun</h3><span class="muted">${W} kelime</span></div>
      <p class="muted" style="margin:6px 0 10px">${due ? `${due} kelimenin tekrar zamanı geldi.` : 'Bugün tekrar edilecek kelime yok.'} Bildiğin kelimeler giderek daha seyrek sorulur.</p>
      <button class="btn ${due ? 'turq' : 'ghost'}" data-act="drev" ${W ? '' : 'disabled'}>Kelimeleri tekrar et</button></div>
    ${!nx ? `<div class="panel"><h3>Seviye sınavı</h3><p class="muted" style="margin-bottom:10px">${lv} konularının hepsini bitirdin. 15 soruluk sınavda 11 doğru yaparsan ${DIL_LEVELS[DIL_LEVELS.indexOf(lv) + 1] || 'son'} seviyesine geçersin.</p><button class="btn turq" data-act="dexam" ${DIL.busy ? 'disabled' : ''}>Sınava gir</button></div>` : ''}
    <details class="fold"><summary><span>Yol haritası</span><small>A1 → C2</small></summary><div class="ybox">${DIL_LEVELS.map(L => {
      const cur = L === lv, past = DIL_LEVELS.indexOf(L) < DIL_LEVELS.indexOf(lv);
      return `<div class="droad ${cur ? 'cur' : ''}"><b>${L}${past ? ' ✓' : cur ? ' · şu an buradasın' : ''}</b>${cur ? `<ul>${DIL_SYL[L].map(t => { const n = dilTp(t); return `<li class="${n >= DIL_PER_TOPIC ? 'ok' : ''}">${n >= DIL_PER_TOPIC ? '✓' : `${n}/${DIL_PER_TOPIC}`} ${esc(t)}</li>`; }).join('')}</ul>` : ''}</div>`; }).join('')}</div></details>
    <details class="fold"><summary><span>Bu seviye için kaynaklar</span><small>Dinleme ve okuma</small></summary><div class="ybox"><ul class="dres">${(DIL_RES[lv] || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="muted" style="font-size:var(--t-meta);margin-top:8px">Konuşma ve dinleme için gerçek ses şart: haftada birkaç kez bu kaynaklardan dinlemeyi ayrı bir görev olarak da ekleyebilirsin.</p></div></details>
    <details class="fold"><summary><span>Ayarlar</span><small>Seviye, test</small></summary><div class="ybox">
      <span class="lab">Seviyeni elle değiştir</span><div class="chips">${DIL_LEVELS.map(L => `<button class="chip ${L === lv ? 'on' : ''}" data-act="dsetlvl" data-id="${L}">${L}</button>`).join('')}</div>
      <button class="btn ghost" style="margin-top:12px" data-act="dplace">Seviye testini yeniden yap</button></div></details></div>`;
}
function dilSetup() {
  if (DIL.test) return `<div class="dil">${dilTestView()}</div>`;
  return `<div class="dil"><header class="phead"><h1>İngilizce</h1><p>A1'den C2'ye adım adım: her gün 15 dakikalık bir ders.</p></header>
    ${DIL.busy ? `<div class="panel"><p>${esc(DIL.busy)}</p></div>` : ''}${DIL.err ? `<div class="panel excuse warn"><p>${esc(DIL.err)}</p></div>` : ''}
    <div class="panel"><h3>Nereden başlayalım?</h3><p class="muted" style="margin-bottom:12px">16 soruluk kısa bir testle seviyeni bulalım. Ya da seviyeni biliyorsan doğrudan seç.</p>
      <button class="btn turq" style="width:100%" data-act="dplace" ${DIL.busy ? 'disabled' : ''}>Seviye testini yap (5 dakika)</button>
      <span class="lab" style="margin-top:14px">Seviyemi biliyorum</span><div class="chips">${DIL_LEVELS.map(L => `<button class="chip" data-act="dsetlvl" data-id="${L}">${L}</button>`).join('')}</div></div>
    <p class="muted" style="font-size:var(--t-meta)">Dersler Satır İzi'ye girdiğin Gemini anahtarıyla hazırlanır. Kelime tekrarı anahtarsız da çalışır.</p></div>`;
}
function dilStepBar(c) { if (c.extra) return ''; const L = (S.lang.les || {})[dk()]; const st = DIL_STEPS.filter(s => s[0] === 'review' || (L && !c.offline));
  return `<div class="dsteps">${st.map(([id, l]) => `<span class="${id === c.step ? 'on' : st.findIndex(x => x[0] === c.step) > st.findIndex(x => x[0] === id) ? 'ok' : ''}">${l}</span>`).join('')}</div>`; }
function dilMcq(q, i, name) {
  const sel = DIL.sel && DIL.sel[name + i];
  return `<div class="dq"><p>${esc(q.q)}</p><div class="dopts">${(q.options || []).map((o, j) => { const st = sel == null ? '' : j === +q.answer ? 'ok' : j === sel ? 'no' : '';
    return `<button class="dopt ${st}" data-act="dpick" data-id="${name}${i}:${j}" ${sel != null ? 'disabled' : ''}>${esc(o)}</button>`; }).join('')}</div>
    ${sel != null && q.why ? `<p class="muted" style="font-size:var(--t-meta);margin-top:6px">${esc(q.why)}</p>` : ''}</div>`;
}
function dilLesson(c) {
  const L = (S.lang.les || {})[dk()], head = `<div class="between"><button class="linkb" data-act="dexit">‹ İngilizce</button><span class="muted">${dilLvl()}${L && !c.offline ? ' · ' + esc(L.topic) : ''}</span></div>${dilStepBar(c)}`;
  if (c.step === 'review') {
    const due = dilDue();
    if (!due.length) return `${head}<div class="panel"><h3>Kelime tekrarı</h3><p class="muted">${c.extra ? 'Tekrar bitti. Aferin.' : 'Bugün tekrar edilecek kelime yok.'}${c.offline && !c.extra ? ' Gemini\'ye şu an ulaşılamadığı için bugün sadece tekrar yapabiliyoruz.' : ''}</p></div><button class="btn turq dnext" data-act="dnext">${c.extra || c.offline ? 'Bitir' : 'Devam'}</button>`;
    const w = due[0];
    return `${head}<div class="panel dcard"><span class="lab">Tekrar · ${due.length} kelime kaldı</span><div class="dword">${esc(w.w)} ${dilSay(w.w)}</div>
      ${DIL.reveal ? `<div class="dmean">${esc(w.tr)}</div>${w.ex ? `<p class="dex">${esc(w.ex)} ${dilSay(w.ex)}</p>` : ''}
        <div class="g2" style="margin-top:14px"><button class="btn ghost" data-act="dgrade" data-id="0">Bilemedim</button><button class="btn turq" data-act="dgrade" data-id="1">Bildim</button></div>`
      : `<button class="btn" style="width:100%;margin-top:14px" data-act="dreveal">Anlamını göster</button>`}</div>
      <button class="linkb" style="margin-top:12px" data-act="dnext">Tekrarı şimdilik geç</button>`;
  }
  if (c.step === 'words') return `${head}<div class="panel"><h3>Bugünün kelimeleri</h3>${(L.words || []).map(w => `<div class="dwrow"><div><b>${esc(w.w)}</b> ${dilSay(w.w)}<small>${esc(w.tr)}</small>${w.ex ? `<p class="dex">${esc(w.ex)}</p>` : ''}</div></div>`).join('')}
      <p class="muted" style="font-size:var(--t-meta);margin-top:8px">Bu kelimeler kelime kutuna eklenecek ve yarından itibaren tekrar sorulacak.</p></div><button class="btn turq dnext" data-act="dwords">Kutuma ekle, devam</button>`;
  if (c.step === 'grammar') { const allA = (L.practice || []).every((q, i) => DIL.sel && DIL.sel['p' + i] != null);
    return `${head}<div class="panel"><h3>${esc(L.topic)}</h3><p style="line-height:1.6">${esc(L.explain)}</p>
      <div class="dexs">${(L.examples || []).map(x => `<div><b>${esc(x.en)}</b> ${dilSay(x.en)}<small>${esc(x.tr)}</small></div>`).join('')}</div></div>
      <div class="panel"><h3>Alıştırma</h3>${(L.practice || []).map((q, i) => dilMcq(q, i, 'p')).join('')}</div>
      <button class="btn turq dnext" data-act="dnext" ${allA ? '' : 'disabled'}>${allA ? 'Devam' : 'Önce soruları cevapla'}</button>`; }
  if (c.step === 'reading') { const R = L.reading || {}, allA = (R.questions || []).every((q, i) => DIL.sel && DIL.sel['r' + i] != null);
    return `${head}<div class="panel"><div class="between"><h3 style="margin:0">${esc(R.title || 'Okuma')}</h3>${dilSay(R.text || '')}</div><p class="dread">${esc(R.text || '')}</p></div>
      <div class="panel"><h3>Anladın mı?</h3>${(R.questions || []).map((q, i) => dilMcq(q, i, 'r')).join('')}</div>
      <button class="btn turq dnext" data-act="dnext" ${allA ? '' : 'disabled'}>${allA ? 'Devam' : 'Önce soruları cevapla'}</button>`; }
  if (c.step === 'writing') { const fb = DIL.fb;
    return `${head}<div class="panel"><h3>Yazma</h3><p style="margin-bottom:10px">${esc(L.writing || 'Bugünkü konuyu kullanarak 2-3 cümle yaz.')}</p>
      <textarea id="dwrite" rows="4" placeholder="Write here…" ${fb ? 'readonly' : ''}>${esc(c.text || '')}</textarea>
      ${fb ? `<div class="dfb"><span class="lab">Düzeltilmiş hâli · ${fb.score}/10</span><p><b>${esc(fb.corrected)}</b> ${dilSay(fb.corrected)}</p>${(fb.notes || []).length ? `<ul>${fb.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}${fb.better ? `<span class="lab">Daha doğal bir söyleyiş</span><p>${esc(fb.better)}</p>` : ''}</div>`
      : `<button class="btn turq" style="width:100%;margin-top:10px" data-act="dcheck" ${DIL.busy ? 'disabled' : ''}>${DIL.busy ? 'Kontrol ediliyor…' : 'Kontrol et'}</button>`}</div>
      ${DIL.err ? `<div class="panel excuse warn"><p>${esc(DIL.err)}</p></div>` : ''}
      <button class="btn ${fb ? 'turq' : 'ghost'} dnext" data-act="dnext">${fb ? 'Dersi bitir' : 'Yazmadan bitir'}</button>`; }
  return '';
}

/* ---------- seviye testi ve sınav ---------- */
async function dilMakeTest(kind) {
  const lv = S.lang && S.lang.lvl;
  const p = kind === 'place'
    ? `Türkçe konuşan bir öğrencinin İngilizce seviyesini ölçmek için 16 soruluk çoktan seçmeli bir test hazırla: A1'den 3, A2'den 3, B1'den 3, B2'den 3, C1'den 3, C2'den 1 soru, kolaydan zora sıralı. Dilbilgisi, kelime ve kısa okuma karışık olsun.
Yalnızca şu JSON'u döndür: {"questions":[{"lvl":"A1","q":"İngilizce soru","options":["","","",""],"answer":0}]}. "answer" doğru seçeneğin sıra numarası (0'dan başlar), yeri sorudan soruya değişsin.`
    : `Türkçe konuşan bir öğrenci için CEFR ${lv} seviyesinin bitiş sınavını hazırla: 15 çoktan seçmeli soru. Şu konuları kapsasın: ${(DIL_SYL[lv] || []).join(', ')}. Dilbilgisi, kelime ve kısa okuma karışık olsun.
Yalnızca şu JSON'u döndür: {"questions":[{"lvl":"${lv}","q":"İngilizce soru","options":["","","",""],"answer":0}]}. "answer" doğru seçeneğin sıra numarası (0'dan başlar), yeri sorudan soruya değişsin.`;
  if (!S.lang) S.lang = {};
  const j = await dilAI(p, 6000);
  if (!j || !Array.isArray(j.questions) || j.questions.length < 8) throw new Error('json');
  return { kind, qs: j.questions.slice(0, 16), i: 0, ans: [] };
}
async function dilBeginTest(kind) {
  DIL.busy = kind === 'place' ? 'Seviye testi hazırlanıyor…' : 'Seviye sınavı hazırlanıyor…'; DIL.err = ''; render();
  try { DIL.test = await dilMakeTest(kind); } catch (e) { DIL.err = dilErrText(e); }
  DIL.busy = ''; tab = 'dil'; render(); window.scrollTo(0, 0);
}
function dilTestView() {
  const T = DIL.test, q = T.qs[T.i];
  if (!q) return dilTestResult();
  return `<header class="phead"><h1>${T.kind === 'place' ? 'Seviye testi' : S.lang.lvl + ' sınavı'}</h1><p>Soru ${T.i + 1} / ${T.qs.length}. Bilmiyorsan tahmin etme, "Bilmiyorum"u seç.</p></header>
    <div class="panel"><div class="dq"><p>${esc(q.q)}</p><div class="dopts">${(q.options || []).map((o, j) => `<button class="dopt" data-act="dtans" data-id="${j}">${esc(o)}</button>`).join('')}
    <button class="dopt idk" data-act="dtans" data-id="-1">Bilmiyorum</button></div></div></div>
    <button class="linkb" data-act="dtquit">Testi bırak</button>`;
}
function dilTestResult() {
  const T = DIL.test, ok = T.qs.map((q, i) => T.ans[i] === +q.answer);
  if (T.kind === 'place') {
    let lv = 'A1';
    for (const L of DIL_LEVELS) { const idx = T.qs.map((q, i) => i).filter(i => T.qs[i].lvl === L); if (!idx.length) continue; const r = idx.filter(i => ok[i]).length / idx.length; if (r >= 0.66) lv = L; else break; }
    T.result = lv;
    return `<header class="phead"><h1>Seviyen: ${lv}</h1><p>${ok.filter(Boolean).length} / ${T.qs.length} doğru.</p></header>
      <div class="panel"><p>Derslere <b>${lv}</b> seviyesinden başlayacağız. ${lv === 'A1' ? 'Temelden başlamak en sağlamı.' : 'Önceki seviyelerden eksik kalan kelimeler derslerde zamanla karşına çıkar.'}</p></div>
      <button class="btn turq dnext" data-act="dtdone" data-id="${lv}">${lv} ile başla</button>
      <div class="chips" style="margin-top:12px">${DIL_LEVELS.map(L => `<button class="chip" data-act="dtdone" data-id="${L}">${L} ile başla</button>`).join('')}</div>`;
  }
  const n = ok.filter(Boolean).length, pass = n >= Math.ceil(T.qs.length * 0.73), nxt = DIL_LEVELS[DIL_LEVELS.indexOf(S.lang.lvl) + 1];
  T.result = pass && nxt ? nxt : S.lang.lvl;
  return `<header class="phead"><h1>${pass ? 'Tebrikler!' : 'Biraz daha çalışalım'}</h1><p>${n} / ${T.qs.length} doğru.</p></header>
    <div class="panel"><p>${pass ? (nxt ? `<b>${nxt}</b> seviyesine geçtin.` : 'C2 seviyesini tamamladın.') : 'Geçmek için biraz daha tekrar gerekiyor. Kelime tekrarına devam et; birkaç gün sonra sınava yeniden girebilirsin.'}</p></div>
    <button class="btn turq dnext" data-act="dtdone" data-id="${T.result}">Tamam</button>`;
}

/* ---------- eylemler (ana betikteki tıklama yöneticisi bunları da çağırır) ---------- */
const DIL_ACT = {
  dstart: () => dilStart(),
  dexit: () => { if (DIL.extra) { DIL.extra = false; return render(); } if (S.lang.cur) S.lang.cur.paused = true; DIL.err = ''; save(); render(); },
  dsay: t => dilSpeak(t),
  dreveal: () => { DIL.reveal = true; render(); },
  dgrade: v => { const w = dilDue()[0]; if (w) dilGrade(w, v === '1'); DIL.reveal = false; save(); render(); },
  drev: () => { if (!dilDue().length) { (S.lang.words || []).slice().sort((a, b) => (a.due || '').localeCompare(b.due || '')).slice(0, 10).forEach(w => w.due = dk()); save(); }
    DIL.extra = true; DIL.reveal = false; render(); window.scrollTo(0, 0); },
  dnext: () => { if (DIL.extra) { DIL.extra = false; render(); return; } dilNext(); },
  dwords: () => { dilAddWords(((S.lang.les || {})[dk()] || {}).words); save(); dilNext(); },
  dpick: v => { const [k, j] = v.split(':'); DIL.sel = { ...(DIL.sel || {}), [k]: +j }; render(); },
  dcheck: async () => {
    const txt = ($('dwrite') || {}).value || ''; if (txt.trim().length < 3) return toast('Önce birkaç cümle yaz.');
    const c = dilCur(); c.text = txt; save(); DIL.busy = 'x'; DIL.err = ''; render();
    try { DIL.fb = await dilAI(`Türkçe konuşan, CEFR ${dilLvl()} seviyesindeki bir öğrenci şu görev için İngilizce yazdı.
Görev: ${((S.lang.les || {})[dk()] || {}).writing || ''}
Öğrencinin yazdığı: """${txt.slice(0, 1200)}"""
Yalnızca şu JSON'u döndür: {"corrected":"hataları düzeltilmiş hâli (anlamı koru)","notes":["Türkçe, kısa açıklamalar: hangi hata neden yanlış (en fazla 4)"],"score":0-10 arası puan,"better":"aynı şeyi daha doğal söyleyen bir örnek"}. Hata yoksa notes'ta bunu belirt.`, 1500); }
    catch (e) { DIL.err = dilErrText(e); }
    DIL.busy = ''; render(); },
  dplace: () => dilBeginTest('place'),
  dexam: () => dilBeginTest('exam'),
  dtans: v => { const T = DIL.test; T.ans[T.i] = +v; T.i++; render(); window.scrollTo(0, 0); },
  dtquit: () => { DIL.test = null; render(); },
  dtdone: L => { const was = S.lang && S.lang.lvl; S.lang = { ...(S.lang || {}), lvl: L }; DIL.test = null; dilEnsureTask(); save(); render(); if (was && was !== L) toast(`${L} seviyesindesin.`); },
  dsetlvl: L => { S.lang = { ...(S.lang || {}), lvl: L }; dilEnsureTask(); save(); render(); toast(`Seviye ${L} olarak ayarlandı.`); },
};
function dilEnsureTask() {
  if (dilTask()) return;
  S.tasks.push({ id: 'ingilizce', name: 'İngilizce', hint: 'Günlük 15 dakikalık ders', icon: 'lisan', type: 'lang', goal: 15, dini: false, days: [0, 1, 2, 3, 4, 5, 6], remind: '', since: dk() });
}
