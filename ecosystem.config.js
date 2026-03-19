module.exports = {
  apps: [
    {
      name: 'sms-frontend-dev',
      script: 'npm',
      args: 'run dev',
      instances: 1,
      autorestart: true,
      watch: false, // Next.js dev server handles hot-reloading
      env_file: '.env',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
    },
    {
      name: process.env.PM2_NAME || 'sms-frontend-prod',
      script: 'npm',
      args: 'start',
      instances: 1, // Using 1 instance for Next.js is standard unless explicitly scaling with cluster module
      autorestart: true,
      watch: false,
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
