const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info_multi");
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        version,
        logger: P({ level: "silent" }),
        auth: state,
    });

    sock.ev.on("connection.update", ({ connection, qr }) => {
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === "open") console.log("✅ WhatsApp Connected");
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        console.log("📥 Received:", text);
        if (text) {
            const reply = await getGPTReply(text);
            await sock.sendMessage(sender, { text: reply });
        }
    });
}

async function getGPTReply(message) {
    try {
        const res = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }],
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        return res.data.choices[0].message.content.trim();
    } catch (err) {
        console.error("GPT Error:", err.response?.data || err.message);
        return "Sorry, I'm having trouble replying right now.";
    }
}

connectBot();