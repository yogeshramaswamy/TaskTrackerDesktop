const config = require('../config');
const { fromSSO } = require('@aws-sdk/credential-providers');
const { getAwsProfile, getAwsRegion } = require('./settings-store');

let client = null;
let model = null;
let builtWith = null; // remembers what the cached client was built from

function buildClient() {
  const profile = getAwsProfile();

  if (config.anthropicApiKey) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: config.anthropicApiKey });
    model = 'claude-sonnet-4-20250514';
    builtWith = 'apikey';
  } else if (profile) {
    const AnthropicBedrock = require('@anthropic-ai/bedrock-sdk').default;
    client = new AnthropicBedrock({
      awsRegion: getAwsRegion(),
      awsCredentials: fromSSO({ profile }),
    });
    model = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
    builtWith = `sso:${profile}`;
  } else {
    throw new Error('No AWS profile configured. Open Settings and enter your AWS profile name.');
  }

  return { client, model };
}

function getAiClient() {
  const profile = getAwsProfile();
  const want = config.anthropicApiKey ? 'apikey' : `sso:${profile}`;
  // Rebuild if nothing cached yet, or the user changed their profile in Settings.
  if (!client || builtWith !== want) {
    return buildClient();
  }
  return { client, model };
}

// Force the next getAiClient() call to rebuild (call after settings change).
function resetAiClient() {
  client = null;
  model = null;
  builtWith = null;
}

module.exports = { getAiClient, resetAiClient };
