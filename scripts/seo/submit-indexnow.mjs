const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const DEFAULT_HOST = 'violema.com';
const DEFAULT_KEY = '33bbbde5b8700c2c95901a438260d51d';

const host = process.env.INDEXNOW_HOST || DEFAULT_HOST;
const key = process.env.INDEXNOW_KEY || DEFAULT_KEY;
const protocol = process.env.INDEXNOW_PROTOCOL || 'https';
const baseUrl = `${protocol}://${host}`;
const dryRun = process.argv.includes('--dry-run');

const urlList = [
  `${baseUrl}/`,
  `${baseUrl}/ai-agents-for-founders/`,
  `${baseUrl}/blog/`,
  `${baseUrl}/blog/what-should-founders-automate-first-with-ai-agents/`,
  `${baseUrl}/blog/ai-agent-vs-workflow-automation/`,
  `${baseUrl}/blog/weekly-founder-update-ai-agent/`,
  `${baseUrl}/blog/human-in-the-loop-ai-agents-for-founders/`,
  `${baseUrl}/integrations`,
  `${baseUrl}/faq`,
  `${baseUrl}/plans`,
];

const payload = {
  host,
  key,
  keyLocation: `${baseUrl}/${key}.txt`,
  urlList,
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(payload),
});

const body = await response.text();
console.log(`IndexNow status: ${response.status} ${response.statusText}`);
if (body) console.log(body);

if (!response.ok && response.status !== 202) {
  process.exitCode = 1;
}
