module.exports = {
  apps: [
    {
      name: 'auction-site',
      script: 'server.mjs',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOST: '0.0.0.0',
        ADMIN_PASSWORD: 'admin123',
      },
    },
  ],
};
