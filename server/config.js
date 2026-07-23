require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  awsRegion: process.env.AWS_REGION || 'us-west-2',
  awsProfile: process.env.AWS_PROFILE || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
};
