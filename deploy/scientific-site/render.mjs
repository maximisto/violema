import { pathToFileURL } from 'node:url';
import { backend, browserPath, publicLegacyPath, redirectPatterns, protectedPath, legacyAssetPrefixes, legacyFiles } from './routing.mjs';

const banner = '# INERT PREPARATION ONLY. Do not include alongside the active vhost.\n# Rendered by deploy/scientific-site/render.mjs; see migration handoff.\n# One EXISTING backend/state/scheduler. No second process is created.\n';
const readOnly = '        if ($request_method !~ ^(GET|HEAD)$) { return 405; }\n';

function proxyLocations() {
  const body = `        proxy_pass ${backend};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;`;
  return ['= /api', '^~ /api/'].map(location => `    location ${location} {\n${body}\n    }`).join('\n');
}

function common() {
  return `    # Return-only if is intentional: protect source paths before ^~ locations.
    if ($scientific_protected_path) { return 404; }
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin always;
${proxyLocations()}`;
}

function companyLocations(companyRoot, legacyRoot) {
  const exact = [
    ['/', '/index.html'], ['/index.html', '/index.html'],
    ['/method', '/method/index.html'], ['/method/', '/method/index.html'],
    ['/demo', '/demo/index.html'], ['/demo/', '/demo/index.html'],
    ['/robots.txt', '/robots.txt'], ['/sitemap.xml', '/sitemap.xml'], ['/llms.txt', '/llms.txt'],
  ].map(([route, file]) => `    location = ${route} {\n${readOnly}        try_files ${file} =404;\n    }`).join('\n');
  const legacyStatic = [...legacyAssetPrefixes.map(value => `^~ ${value}`), ...legacyFiles.map(value => `= ${value}`)]
    .map(location => `    location ${location} {\n${readOnly}        root ${legacyRoot};\n        try_files $uri $uri/index.html =404;\n    }`).join('\n');
  return `    root ${companyRoot};
${exact}
    location ^~ /company-assets/ {
${readOnly}        try_files $uri =404;
    }
${legacyStatic}
    # Unknown/sensitive queries stay on the original host; no token transfer.
    location ~ "^(?:${browserPath}|${publicLegacyPath})/?$" {
${readOnly}        if ($scientific_browser_redirect != "") { return 302 $scientific_browser_redirect; }
        root ${legacyRoot};
        try_files /index.html =404;
    }
    # Scientific routes never fall through into the legacy SPA.
    location / { return 404; }`;
}

function appLocations(legacyRoot) {
  return `    root ${legacyRoot};
    index index.html;
    location / {
${readOnly}        try_files $uri $uri/ /index.html;
    }`;
}

function pathArgument(value, name) {
  if (!/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(value) || value.split('/').includes('..')) throw new Error(`${name} must be an absolute nginx-safe path without spaces or traversal`);
  return value;
}

export function render({ mode = 'preview', companyRoot = '/var/www/nexus/company-site/dist', legacyRoot = '/var/www/nexus/frontend/dist' } = {}) {
  if (!['preview', 'cutover'].includes(mode)) throw new Error('mode must be preview or cutover');
  pathArgument(companyRoot, 'companyRoot');
  pathArgument(legacyRoot, 'legacyRoot');
  if (companyRoot === legacyRoot) throw new Error('company and app roots must differ');
  const destination = mode === 'preview' ? 'http://127.0.0.1:8089' : 'https://agent.purpleorange.ai';
  const rules = redirectPatterns.map(pattern => `    "~^(?:GET|HEAD):${pattern.slice(1)}" "${destination}$request_uri#";`).join('\n');
  const maps = `# Place these map directives in nginx http context, never inside server.
map "$request_method:$request_uri" $scientific_browser_redirect {
    default "";
${rules}
}
map $uri $scientific_protected_path {
    default 0;
    "~*${protectedPath}" 1;
}
`;
  const server = (listen, name, tls, content) => `server {
    listen ${listen};
    server_name ${name};
${tls}${common()}
${content}
}
`;
  if (mode === 'preview') return banner + '# LOOPBACK ONLY. Requires a separately approved local backend fixture on :3001.\n' + maps + server('127.0.0.1:8088', 'localhost', '', companyLocations(companyRoot, legacyRoot)) + server('127.0.0.1:8089', 'localhost', '', appLocations(legacyRoot));
  const tls = name => `    ssl_certificate /etc/letsencrypt/live/${name}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${name}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
`;
  const httpOnly = `    location / {
${readOnly}        return 308 https://$host$request_uri;
    }`;
  return banner + '# TLS paths are prerequisites, NOT evidence certificates exist.\n' + maps
    + server('80', 'violema.com www.violema.com agent.purpleorange.ai', '', httpOnly)
    + server('443 ssl', 'violema.com www.violema.com', tls('violema.com'), companyLocations(companyRoot, legacyRoot))
    + server('443 ssl', 'agent.purpleorange.ai', tls('agent.purpleorange.ai'), appLocations(legacyRoot));
}

// stdout only: this command cannot install config, reload services, edit env,
// mutate DNS/providers, start PM2, or read secrets. The caller chooses any file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const options = {};
  const names = { '--mode': 'mode', '--company-root': 'companyRoot', '--legacy-root': 'legacyRoot' };
  for (let i = 0; i < args.length; i += 2) {
    if (!names[args[i]] || !args[i + 1]) throw new Error('Usage: node render.mjs [--mode preview|cutover] [--company-root /absolute/path] [--legacy-root /absolute/path]');
    options[names[args[i]]] = args[i + 1];
  }
  process.stdout.write(render(options));
}
