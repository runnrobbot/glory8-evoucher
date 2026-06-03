module.exports = {
  apps: [
    {
      name: 'glory8-evoucher',
      script: 'npx',
      args: 'serve dist -l 5050 -s',
      cwd: '/var/www/glory8-evoucher',
      env: {
        NODE_ENV: 'production',
        PORT: 5050,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      error_file: '/var/log/pm2/glory8-evoucher-error.log',
      out_file: '/var/log/pm2/glory8-evoucher-out.log',
      log_file: '/var/log/pm2/glory8-evoucher-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
