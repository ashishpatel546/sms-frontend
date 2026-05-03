import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import fs from 'fs';

const isLocal =
  process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development';
if (isLocal && !process.env.FORCE_AWS_SSM) {
  console.log('📄 Using local environment config (AWS SSM skipped)');
  process.exit(0);
}

const env = process.env.SSM_ENV || process.env.NODE_ENV || 'development';

console.log(`🔄 Fetching env from AWS SSM for env [${env}]...`);

// We assume EC2 IAM Profile provides credentials automatically
const ssmClient = new SSMClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const ssmPath = `/sms-frontend/${env}/`;

const fetchParams = async (path) => {
  let nextToken = undefined;
  const allParams = [];
  try {
    do {
      const command = new GetParametersByPathCommand({
        Path: path,
        WithDecryption: true,
        Recursive: true,
        NextToken: nextToken,
      });
      const response = await ssmClient.send(command);
      if (response.Parameters) {
        allParams.push(...response.Parameters);
      }
      nextToken = response.NextToken;
    } while (nextToken);
  } catch (err) {
    if (
      err.name === 'ParameterNotFound' ||
      err.name === 'AccessDeniedException'
    ) {
      console.warn(`Warning: Could not fetch path ${path} - ${err.message}`);
    } else {
      throw err;
    }
  }
  return allParams;
};

const run = async () => {
  try {
    const params = await fetchParams(ssmPath);

    if (params.length === 0) {
      console.warn('⚠️ No parameters found in SSM.');
    }

    let envContent = '';

    const processParam = (param, prefix) => {
      if (!param.Name || !param.Value) return;
      const key = param.Name.replace(prefix, '');
      envContent += `${key}="${param.Value}"\n`;
    };

    params.forEach((p) => processParam(p, ssmPath));

    // PORT and NODE_ENV are owned by ecosystem.config.js — never overwrite from SSM
    envContent = envContent
      .split('\n')
      .filter(
        (line) => !line.startsWith('PORT=') && !line.startsWith('NODE_ENV='),
      )
      .join('\n');

    // Append PORT from deployment environment so PM2 starts on the right port
    if (process.env.PORT) {
      envContent += `\nPORT=${process.env.PORT}\n`;
    }

    fs.writeFileSync('.env', envContent);
    console.log(`✅ Fetched and wrote ${params.length} parameters to .env`);
  } catch (e) {
    console.error('❌ Failed to fetch parameters from SSM', e);
    process.exit(1);
  }
};

run();
