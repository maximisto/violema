# Nexus VPS deploy

1. Point `nexus.purpleorange.io` at the VPS public IP.
2. SSH into the VPS as `root` or a sudo user.
3. Run:

```bash
git clone https://github.com/maximisto/test-repo.git /tmp/test-repo
cd /tmp/test-repo/deploy
sudo bash deploy.sh
```

4. Before rerunning if the backend stops on startup, create:

```bash
sudo mkdir -p /var/www/nexus/backend
sudo tee /var/www/nexus/backend/.env >/dev/null <<'EOF'
ANTHROPIC_API_KEY=your_real_key
PORT=3001
NODE_ENV=production
EOF
```

5. Check status:

```bash
pm2 status
pm2 logs nexus-backend
sudo systemctl status nginx
curl -I https://nexus.purpleorange.io
```

Notes:
- The deploy script now bootstraps nginx over HTTP first, then switches to the full HTTPS config after Certbot succeeds.
- The frontend is served from `frontend/dist` and `/api/*` is proxied to the Express backend on port `3001`.
