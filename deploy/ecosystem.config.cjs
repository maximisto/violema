module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'violema-backend',
      script: './dist/server.js',
      cwd: process.env.APP_BACKEND_CWD || '/var/www/nexus/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // ANTHROPIC_API_KEY must be in the backend .env for the active deploy path
      // PM2 loads dotenv automatically via the backend's own dotenv.config()
      error_file: '/var/log/nexus/err.log',
      out_file: '/var/log/nexus/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
