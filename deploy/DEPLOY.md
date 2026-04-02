# VIOLEMA VPS deploy

1. Point `violema.com` and `www.violema.com` at the VPS public IP.
2. SSH into the VPS as `root` or a sudo user.
3. Run:

```bash
git clone https://github.com/maximisto/test-repo.git /tmp/test-repo
cd /tmp/test-repo/deploy
sudo bash deploy.sh
```

Optional overrides:

```bash
sudo DOMAIN=violema.com APP_DIR=/var/www/nexus PM2_APP_NAME=violema-backend bash deploy.sh
```

4. Before rerunning if the backend stops on startup, create:

```bash
sudo mkdir -p /var/www/nexus/backend
sudo tee /var/www/nexus/backend/.env >/dev/null <<'EOF'
ANTHROPIC_API_KEY=your_real_key
TAVILY_API_KEY=your_tavily_key
POSTMARK_API_KEY=your_postmark_server_api_key
POSTMARK_FROM_EMAIL=demo@yourdomain.com
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
PUBLIC_APP_URL=https://violema.com
APP_BASE_URL=https://violema.com
OPENROUTER_SITE_URL=https://violema.com
OPENROUTER_APP_NAME=VIOLEMA
PORT=3001
NODE_ENV=production
EOF
```

5. Check status:

```bash
pm2 status
pm2 logs violema-backend
sudo systemctl status nginx
curl -I https://violema.com
curl https://violema.com/api/health
```

Notes:
- The deploy script now bootstraps nginx over HTTP first, then switches to the full HTTPS config after Certbot succeeds.
- The frontend is served from `frontend/dist` and `/api/*` is proxied to the Express backend on port `3001`.
- `/api/health` now reports which real integrations are configured: Anthropic, Tavily, Postmark, and Slack.
