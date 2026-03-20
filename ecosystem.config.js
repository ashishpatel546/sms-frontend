require('dotenv').config();
const PORT = process.env.PORT || 3000;

module.exports = {
  apps: [
    {
      name: 'sms-frontend-dev',
      script: 'node_modules/next/dist/bin/next',
      args: `dev -p ${PORT}`,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false, // Next.js dev server handles hot-reloading
      env_file: '.env',
      env: {
        NODE_ENV: 'development',
        PORT,
      },
    },
    {
      name: process.env.PM2_NAME || 'sms-frontend-prod',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${PORT}`,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT,
      },
    },
  ],
};
