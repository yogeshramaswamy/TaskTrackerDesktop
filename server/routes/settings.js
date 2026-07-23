const express = require('express');
const router = express.Router();
const { readSettings, writeSettings, getAwsProfile, AWS_REGION } = require('../services/settings-store');
const { resetAiClient, getAiClient } = require('../services/ai-client');

// Return current AWS settings (never leak more than needed).
router.get('/', (req, res) => {
  const s = readSettings();
  res.json({
    awsProfile: getAwsProfile(),
    awsRegion: AWS_REGION,
    source: s.awsProfile ? 'settings' : (process.env.AWS_PROFILE ? 'env' : 'none'),
  });
});

// Save the AWS profile chosen by the user; region is fixed.
router.put('/', (req, res) => {
  const { awsProfile } = req.body;
  if (typeof awsProfile !== 'string') {
    return res.status(400).json({ error: 'awsProfile must be a string' });
  }
  writeSettings({ awsProfile: awsProfile.trim() });
  resetAiClient(); // next AI call rebuilds with the new profile
  res.json({ awsProfile: getAwsProfile(), awsRegion: AWS_REGION });
});

// Verify the profile actually works by making a tiny Bedrock call.
router.post('/test', async (req, res) => {
  try {
    resetAiClient();
    const { client, model } = getAiClient();
    await client.messages.create({
      model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    });
    res.json({ ok: true, message: `Connected using profile "${getAwsProfile()}" in ${AWS_REGION}.` });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
