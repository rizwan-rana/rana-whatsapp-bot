const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('✅ WhatsApp Auto-Reply is active.');
});

app.post('/incoming', async (req, res) => {
  const incomingMsg = req.body.Body?.trim();
  const sender = req.body.From;
  const twiml = new MessagingResponse();

  if (!incomingMsg) {
    twiml.message("⚠️ Received an empty message.");
    return res.send(twiml.toString());
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const gptResponse = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant who replies in Roman Urdu.' },
        { role: 'user', content: incomingMsg }
      ],
      model: 'gpt-4',
    });

    const reply = gptResponse.choices[0].message.content.trim();
    twiml.message(reply);
  } catch (err) {
    console.error('❌ Error from OpenAI or server:', err.message);
    twiml.message("Sorry, system error aya hai. Try again shortly.");
  }

  res.send(twiml.toString());
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
