module.exports = {
  apps: [
    {
      name: 'nexus-backend',
      script: './backend/dist/server.js',
      cwd: '/var/www/nexus',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // ANTHROPIC_API_KEY must be in /var/www/nexus/backend/.env
      // PM2 loads dotenv automatically via the backend's own dotenv.config()
      error_file: '/var/log/nexus/err.log',
      out_file: '/var/log/nexus/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
