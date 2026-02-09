const express = require('express');
const QRCode = require('qrcode');
const { db } = require('../db');
const { encrypt } = require('../utils/encryption');
const { isValidPhone, isValidMessage, MAX_MESSAGE_LENGTH } = require('../utils/validation');

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { phone, message } = req.body;

    // Validate phone number (E.164)
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({
        error: 'Invalid phone number. Must be in E.164 format (e.g., +1234567890).',
      });
    }

    // Validate message
    if (message && !isValidMessage(message)) {
      return res.status(400).json({
        error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    // Build WhatsApp link
    const cleanPhone = phone.replace('+', '');
    let waLink = `https://wa.me/${cleanPhone}`;
    if (message && message.trim()) {
      waLink += `?text=${encodeURIComponent(message)}`;
    }

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(waLink, {
      width: 256,
      margin: 2,
      color: { dark: '#25D366', light: '#FFFFFF' },
    });

    // Encrypt PII for storage
    const piiPayload = JSON.stringify({ phone, message: message || '' });
    const { encrypted, iv, authTag } = encrypt(piiPayload);

    // Log to database
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    db.run(
      `INSERT INTO link_requests (encrypted_data, iv, auth_tag, ip_address, user_agent, whatsapp_link) VALUES (?, ?, ?, ?, ?, ?)`,
      [encrypted, iv, authTag, ip, userAgent, waLink]
    );
    db.save();

    res.json({
      link: waLink,
      qrCode: qrDataUrl,
    });
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

module.exports = router;
