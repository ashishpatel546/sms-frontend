import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import fs from 'fs';

const isLocal = process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development';
if (isLocal && !process.env.FORCE_AWS_SSM) {
  console.log('📄 Using local environment config (AWS SSM skipped)');
  process.exit(0);
}

const env = process.env.SSM_ENV || process.env.NODE_ENV || 'stage';
// The PM2 / deploy script should pass the tenant via process.env.SCHOOL_SLUG
const tenant = process.env.SCHOOL_SLUG;
if (!tenant) {
  console.error('❌ SCHOOL_SLUG environment variable is missing.');
  process.exit(1);
}

console.log(`🔄 Fetching env from AWS SSM for tenant [${tenant}] on env [${env}]...`);

// We are assuming EC2 IAM Profile will provide credentials automatically
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const sharedPath = `/sms/${env}/shared/`;
const tenantPath = `/sms/${env}/${tenant}/frontend/`;

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
    if (err.name === 'ParameterNotFound' || err.name === 'AccessDeniedException') {
       console.warn(`Warning: Could not fetch path ${path} - ${err.message}`);
    } else {
       throw err;
    }
  }
  return allParams;
};

const run = async () => {
   try {
      const sharedParams = await fetchParams(sharedPath);
      const tenantParams = await fetchParams(tenantPath);

      if (sharedParams.length === 0 && tenantParams.length === 0) {
         console.warn("⚠️ No parameters found in SSM.");
      }

      let envContent = '';
      
      const processParam = (param, prefix) => {
         if (!param.Name || !param.Value) return;
         const key = param.Name.replace(prefix, '');
         envContent += `${key}=${param.Value}\n`;
      };
      
      sharedParams.forEach(p => processParam(p, sharedPath));
      // Tenant overrides shared
      tenantParams.forEach(p => processParam(p, tenantPath));

      // Append explicitly passed PORT from deployment script if not provided by SSM
      if (process.env.PORT && !envContent.includes('PORT=')) {
         envContent += `PORT=${process.env.PORT}\n`;
      }

      fs.writeFileSync('.env', envContent);
      console.log(`✅ Fetched and wrote ${sharedParams.length + tenantParams.length} parameters to .env`);
   } catch(e) {
      console.error('❌ Failed to fetch parameters from SSM', e);
      process.exit(1);
   }
};

run();
