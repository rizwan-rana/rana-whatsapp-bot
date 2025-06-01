const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log("Connection closed:", reason);
    } else if (connection === "open") {
      console.log("✅ WhatsApp connected!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (!messages || !messages[0]?.message) return;

    const msg = messages[0];
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    console.log("📩 New message:", text);

    if (!text) return;

    const reply = await getReply(text);

    if (reply) {
      await sock.sendMessage(msg.key.remoteJid, { text: reply });
    }
  });

  async function getReply(message) {
    try {
      const res = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
      }, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.error("GPT error:", err?.response?.data || err.message);
      return "Sorry, I'm having trouble replying right now.";
    }
  }

  return sock;
}

connectToWhatsApp();
