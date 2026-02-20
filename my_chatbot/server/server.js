// ============================================================
//  server.js — Express proxy server
//  Keeps your Groq API key safe on the server side
// ============================================================

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve your frontend files from the parent folder
app.use(express.static(path.join(__dirname, '..')));

// ─── GROQ PROXY ENDPOINT ───────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, system } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:      model || 'llama3-8b-8192',
        messages:   [{ role: 'system', content: system }, ...messages],
        max_tokens: 512,
        temperature: 0.75,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Aria chatbot server running at http://localhost:${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
});
