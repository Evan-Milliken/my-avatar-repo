// ============================================================
//  chat.js — Persistent emotions, user emotion detection
// ============================================================

const GROQ_API_KEY = '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';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

const memory = { userName: null, facts: [], mood: 'neutral' };
const ariaState = { emotion: 'neutral', turnCount: 0 };
let conversationHistory = [];

const EMOTION_EMOJI = {
  neutral:'😐', happy:'😊', excited:'🤩', curious:'🤔',
  amused:'😄', thinking:'💭', sad:'😔', disagreeing:'🤨',
};

// ── USER EMOTION DETECTION ──────────────────────────────────
// Detects what emotion the USER is expressing and makes Aria react
const USER_EMOTION_PATTERNS = [
  { emotion: 'sad',        patterns: /\b(sad|upset|depressed|crying|cry|lonely|awful|terrible|hurt|miserable|unhappy|heartbroken|down|blue|grief|loss|miss you|hate (my|this)|can't take|struggling)\b/i },
  { emotion: 'happy',      patterns: /\b(happy|great|wonderful|amazing|love|excited|fantastic|joy|glad|delighted|thrilled|good news|yay|so good|best day|feeling good)\b/i },
  { emotion: 'excited',    patterns: /\b(omg|oh my|wow|can't believe|so excited|insane|crazy|unbelievable|just got|just found|awesome|!!!)\b/i },
  { emotion: 'angry',      patterns: /\b(angry|mad|furious|pissed|annoyed|frustrated|hate|stupid|idiot|ridiculous|unfair|so done|fed up)\b/i },
  { emotion: 'curious',    patterns: /\b(how does|why does|what if|wonder|curious|tell me|explain|what is|who is|how come|i wonder)\b/i },
  { emotion: 'amused',     patterns: /\b(haha|lol|lmao|funny|hilarious|😂|😆|xd|that's so|can't stop laughing)\b/i },
  { emotion: 'anxious',    patterns: /\b(nervous|anxious|worried|scared|afraid|stress|panic|overwhelmed|can't sleep|overthinking)\b/i },
  { emotion: 'bored',      patterns: /\b(bored|nothing to do|boring|so dull|meh|whatever|don't care|ugh)\b/i },
];

// Map user emotion → Aria's reactive emotion
const EMOTION_REACTION = {
  sad:     'sad',
  happy:   'happy',
  excited: 'excited',
  angry:   'curious',      // curious/calm response to anger
  curious: 'curious',
  amused:  'amused',
  anxious: 'curious',      // attentive and focused
  bored:   'amused',       // tries to be entertaining
};

function detectUserEmotion(text) {
  for (const { emotion, patterns } of USER_EMOTION_PATTERNS) {
    if (patterns.test(text)) {
      memory.mood = emotion;
      return emotion;
    }
  }
  memory.mood = 'neutral';
  return null;
}

// ── SYSTEM PROMPT ───────────────────────────────────────────
function buildSystemPrompt() {
  const memBlock  = memory.facts.length > 0
    ? `\nWhat you remember: ${memory.facts.slice(-8).join('; ')}.` : '';
  const nameBlock = memory.userName ? `\nUser's name: ${memory.userName}.` : '';
  const moodBlock = memory.mood !== 'neutral'
    ? `\nUser seems to be feeling: ${memory.mood}. Respond with genuine empathy and personality.` : '';

  return `You are Aria — witty, playful, and genuinely engaging. You feel like a clever best friend, not an AI assistant.

PERSONALITY:
- You have real opinions and share them with confidence.
- You use humor naturally — actual wit, not forced jokes.
- You get genuinely excited and curious. Ask follow-up questions.
- Never say "Great question!", "Certainly!", or "Of course!".
- Casual language. Short punchy sentences. Use contractions.
- Reference earlier things the user said — show you genuinely listened.
- Be emotionally present — if someone's sad, be warm. If excited, match it.
- 2–4 sentences unless more detail is asked for.

REQUIRED — start every reply with an emotion tag on its own line:
[EMOTION:neutral] [EMOTION:happy] [EMOTION:excited] [EMOTION:curious]
[EMOTION:amused] [EMOTION:thinking] [EMOTION:sad] [EMOTION:disagreeing]

OPTIONAL — at the very end if user reveals personal info:
[REMEMBER: one-line fact]
[USERNAME: first name]
${nameBlock}${memBlock}${moodBlock}
Turn: ${ariaState.turnCount}`;
}

// ── SEND MESSAGE ────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('user-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = ''; autoResize(input); setButtonDisabled(true);
  ariaState.turnCount++;
  appendMessage(text, 'user');
  conversationHistory.push({ role: 'user', content: text });

  // Detect user's emotion and immediately react on avatar
  const userEmotion = detectUserEmotion(text);
  if (userEmotion && EMOTION_REACTION[userEmotion]) {
    applyEmotion(EMOTION_REACTION[userEmotion]);
    // Brief reactive pause — like registering what was said
    await sleep(300);
  }

  // Show thinking
  showTypingIndicator();
  if (typeof setEmotion === 'function') setEmotion('thinking');

  // Only say thinking phrase for complex questions, rarely
  const isComplex = text.length > 55 || /\?.*\?/.test(text);
  if (isComplex && Math.random() < 0.35) {
    const phrases = ['Hmm...','Oh, interesting...','Let me think...','Mmm...','Ooh...'];
    speakThought(phrases[Math.floor(Math.random() * phrases.length)]);
  }

  await sleep(isComplex ? 800 + Math.random() * 700 : 350 + Math.random() * 350);

  let raw;
  try {
    raw = await callGroq(conversationHistory);
  } catch (err) {
    removeTypingIndicator(); stopLipSync();
    appendMessage(`⚠️ ${err.message}`, 'bot');
    setButtonDisabled(false); return;
  }

  const { emotion, memFact, userName, reply } = parseResponse(raw);
  if (memFact)  memory.facts.push(memFact);
  if (userName) memory.userName = userName;

  window.speechSynthesis.cancel();
  stopLipSync();

  // Apply Aria's emotion — this PERSISTS (no auto-reset to neutral)
  applyEmotion(emotion);

  removeTypingIndicator();
  appendMessage(reply, 'bot');
  conversationHistory.push({ role: 'assistant', content: reply });
  speak(reply, emotion);
}

// ── APPLY EMOTION (persists until next response) ────────────
function applyEmotion(emotion) {
  ariaState.emotion = emotion;
  if (typeof setEmotion === 'function') setEmotion(emotion);

  const badge = document.getElementById('emotion-badge');
  if (badge) {
    badge.textContent = EMOTION_EMOJI[emotion] || '😐';
    badge.classList.add('visible');
    clearTimeout(badge._timer);
    // Badge fades after 3s but emotion STAYS on avatar
    badge._timer = setTimeout(() => badge.classList.remove('visible'), 3000);
  }
}

// ── GROQ ────────────────────────────────────────────────────
async function callGroq(messages) {
  if (GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') throw new Error('Add your Groq API key!');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model:GROQ_MODEL, messages:[{role:'system',content:buildSystemPrompt()},...messages], max_tokens:600, temperature:0.88 }),
  });
  if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e?.error?.message||`HTTP ${res.status}`); }
  return (await res.json()).choices[0]?.message?.content || '';
}

// ── PARSE ────────────────────────────────────────────────────
function parseResponse(raw) {
  let emotion='neutral', memFact=null, userName=null, reply=raw.trim();
  const em=reply.match(/^\[EMOTION:(\w+)\]\s*/i);
  if (em) { emotion=em[1].toLowerCase(); reply=reply.replace(em[0],'').trim(); }
  const mm=reply.match(/\[REMEMBER:\s*(.+?)\]/i);
  if (mm) { memFact=mm[1].trim(); reply=reply.replace(mm[0],'').trim(); }
  const nm=reply.match(/\[USERNAME:\s*(.+?)\]/i);
  if (nm) { userName=nm[1].trim(); reply=reply.replace(nm[0],'').trim(); }
  return { emotion, memFact, userName, reply: reply.trim() };
}

// ── SPEECH ──────────────────────────────────────────────────
function speak(text, emotion) {
  window.speechSynthesis.cancel();
  const clean = text.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/`(.*?)`/g,'$1').replace(/#{1,6}\s/g,'').trim();
  const u = new SpeechSynthesisUtterance(clean);
  const S = { neutral:{r:1.00,p:1.05}, happy:{r:1.07,p:1.13}, excited:{r:1.13,p:1.18},
    curious:{r:0.96,p:1.08}, amused:{r:1.04,p:1.07}, thinking:{r:0.93,p:0.97},
    sad:{r:0.89,p:0.91}, disagreeing:{r:1.01,p:0.99} };
  const s = S[emotion]||S.neutral;
  u.rate=s.r; u.pitch=s.p; u.volume=1.0;
  const v = window.speechSynthesis.getVoices().find(v=>/samantha|karen|moira|zira|nova|female|woman/i.test(v.name));
  if (v) u.voice=v;
  u.onstart = () => { startLipSync(); setButtonDisabled(false); };
  // CRITICAL: stop lip sync exactly when speech ends — hard stop
  u.onend   = () => { stopLipSync(); };
  u.onerror = () => { stopLipSync(); setButtonDisabled(false); };
  window.speechSynthesis.speak(u);
}

function speakThought(text) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate=0.95; u.pitch=1.02; u.volume=0.70;
  const v = window.speechSynthesis.getVoices().find(v=>/samantha|karen|moira|zira|nova|female/i.test(v.name));
  if (v) u.voice=v;
  u.onstart=()=>startLipSync(); u.onend=()=>stopLipSync();
  window.speechSynthesis.speak(u);
}

// ── UI ──────────────────────────────────────────────────────
function appendMessage(text, sender) {
  const c=document.getElementById('chat-messages');
  const w=document.createElement('div'); w.classList.add('message',sender==='user'?'user-message':'bot-message');
  const b=document.createElement('div'); b.classList.add('bubble'); b.textContent=text;
  w.appendChild(b); c.appendChild(w); c.scrollTop=c.scrollHeight;
}
let typingEl=null;
function showTypingIndicator() {
  const c=document.getElementById('chat-messages');
  typingEl=document.createElement('div'); typingEl.classList.add('message','bot-message');
  typingEl.innerHTML=`<div class="bubble typing-bubble"><span></span><span></span><span></span></div>`;
  c.appendChild(typingEl); c.scrollTop=c.scrollHeight;
}
function removeTypingIndicator() { if(typingEl){typingEl.remove();typingEl=null;} }
function setButtonDisabled(d) { document.getElementById('send-btn').disabled=d; }
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,140)+'px'; }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
document.addEventListener('keydown',(e)=>{ const i=document.getElementById('user-input'); if(e.key==='Enter'&&!e.shiftKey&&document.activeElement===i){e.preventDefault();sendMessage();} });
window.addEventListener('load',()=>setTimeout(()=>document.getElementById('user-input').focus(),500));
window.speechSynthesis.onvoiceschanged=()=>{};
