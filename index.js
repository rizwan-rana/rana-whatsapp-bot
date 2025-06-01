const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// Load Baileys session from file
const { state, saveState } = useSingleFileAuthState('./auth_info/session.json');

// Main connection function
async function connectToWhatsApp() {
    const sock = makeWASocket({
        auth: state,
        logger: require('pino')({ level: 'silent' }),
    });

    // Save session updates
    sock.ev.on('creds.update', saveState);

    // Connection closed handling
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected');
        }
    });

    // Message listener
    sock.ev.on('messages.upsert', async (msg) => {
        const m = msg.messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!text) return;

        console.log('📩 Message from:', m.key.remoteJid, '| Text:', text);

        const reply = await getGPTReply(text);
        if (reply) {
            await sock.sendMessage(m.key.remoteJid, { text: reply }, { quoted: m });
        }
    });
}

// GPT-3.5 reply function
async function getGPTReply(message) {
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful WhatsApp assistant.' },
                { role: 'user', content: message }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return res.data.choices[0].message.content.trim();
    } catch (err) {
        console.error('❌ GPT API Error:', err.message);
        return "Sorry, I'm having trouble replying right now.";
    }
}

// Start the bot
connectToWhatsApp();
