# 🤖 Aria — AI Chatbot with Avatar, Eye Gaze & Lip Sync

A free, browser-based AI chatbot using Groq's API with a 3D animated avatar.

---

## 📁 File Structure

```
my-chatbot/
├── index.html      ← Main webpage
├── style.css       ← All styling
├── avatar.js       ← 3D avatar, eye gaze, lip sync
├── chat.js         ← Groq API + chat logic + TTS
├── avatar.glb      ← YOUR avatar file (you add this!)
└── server/
    ├── server.js   ← Node.js proxy server (for deployment)
    ├── package.json
    └── .env        ← Your secret API key (never share this!)
```

---

## 🚀 STEP-BY-STEP SETUP

### Step 1 — Add your avatar file
Copy your `.glb` avatar file into the `my-chatbot/` folder and rename it `avatar.glb`.

> **Get a free avatar:** Go to https://readyplayer.me → create an avatar → download the `.glb` file.

---

### Step 2 — Quick local test (no install needed)
Open `index.html` directly in Chrome. But first:

1. Open `chat.js` in any text editor (Notepad, VS Code, etc.)
2. Find this line near the top:
   ```
   const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';
   ```
3. Replace `YOUR_GROQ_API_KEY_HERE` with your actual Groq API key.
4. Save the file.

**⚠️ Note:** Opening index.html directly works for testing but browsers block local .glb files due to security. Use a local server for the avatar to load (see Step 3).

---

### Step 3 — Run with a local server (recommended)

**Option A — Using VS Code (easiest):**
1. Install VS Code: https://code.visualstudio.com
2. Install the "Live Server" extension (search in Extensions tab)
3. Right-click `index.html` → "Open with Live Server"
4. Your browser opens automatically at `http://localhost:5500`

**Option B — Using Node.js:**
1. Install Node.js: https://nodejs.org (download the LTS version)
2. Open Terminal / Command Prompt
3. Navigate to the server folder:
   ```
   cd path/to/my-chatbot/server
   ```
4. Install dependencies (only once):
   ```
   npm install
   ```
5. Add your API key to `server/.env`:
   ```
   GROQ_API_KEY=your_actual_key_here
   ```
6. Start the server:
   ```
   npm start
   ```
7. Open http://localhost:3000 in your browser

---

### Step 4 — Deploy FREE for the whole world to access

**Option A — Render.com (easiest, 100% free):**
1. Create a free account at https://render.com
2. Connect your GitHub account
3. Push your `my-chatbot` folder to a GitHub repository
4. On Render: New → Web Service → connect your repo
5. Settings:
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `node server.js`
6. Add environment variable: `GROQ_API_KEY` = your key
7. Click Deploy → Render gives you a public URL like `https://your-app.onrender.com`

**Option B — Railway.app (also free):**
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Same settings as above
4. Add `GROQ_API_KEY` in the Variables tab

---

## 🎨 Customization

### Change the chatbot's name & personality
In `chat.js`, edit the `SYSTEM_PROMPT` variable:
```js
const SYSTEM_PROMPT = `You are [NAME], a [personality description]...`;
```

### Change the AI model
In `chat.js`:
```js
const GROQ_MODEL = 'llama3-70b-8192'; // smarter but slightly slower
```

### Change avatar camera angle
In `avatar.js`, adjust these lines to zoom in/out:
```js
camera.position.set(0, 1.6, 2.2); // x, y, z position
camera.lookAt(0, 1.5, 0);          // where camera points
```

### Change colors/theme
In `style.css`, edit the CSS variables at the top:
```css
:root {
  --accent:  #7c6af7;  /* purple → change to any color */
  --accent2: #f7a26a;  /* orange accent */
  --bg:      #0a0a0f;  /* background */
}
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| Avatar doesn't load | Make sure `avatar.glb` is in the `my-chatbot/` folder |
| "YOUR_GROQ_API_KEY" error | Edit `chat.js` and paste your real key |
| No voice/speech | Click anywhere on the page first (browsers require user interaction) |
| Lip sync not moving | Your avatar may not have morph targets — get one from readyplayer.me |
| CORS error in console | Use the Node.js server instead of opening HTML directly |

---

## 🔑 Free Services Used

| Service | What for | Free Tier |
|---------|----------|-----------|
| [Groq](https://console.groq.com) | AI brain (LLM) | 14,400 req/day |
| [Ready Player Me](https://readyplayer.me) | 3D avatar | Free forever |
| [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) | Text-to-speech | Built into browser |
| [Render.com](https://render.com) | Hosting | Free tier |
| [Three.js](https://threejs.org) | 3D rendering | Open source |

Total cost: **$0** 🎉
