import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function changedUrls(previous, current) {
  return [...new Set([...Object.keys(current), ...Object.keys(previous)])]
    .filter(url => current[url] !== previous[url]);
}

export async function submit(payload, request = fetch) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(payload.key)) throw Error('Invalid IndexNow key');
  if (!payload.urlList.length || payload.urlList.length > 10000) throw Error('Invalid URL count');
  for (const value of payload.urlList) {
    const url = new URL(value);
    if (url.host !== payload.host || url.protocol !== 'https:' || url.search || url.hash)
      throw Error(`Invalid host or noncanonical URL: ${value}`);
  }
  const response = await request('https://www.bing.com/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
  });
  const body = await response.text();
  if (![200, 202].includes(response.status)) throw Error(`Bing IndexNow HTTP ${response.status}: ${body}`);
  return { status: response.status, pending: response.status === 202, body };
}

const hash = text => createHash('sha256').update(text).digest('hex');
async function main() {
  const { host, key } = JSON.parse(await readFile('indexnow.json', 'utf8'));
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (!urls.length) throw Error('Empty sitemap');
  const current = {};
  for (const value of urls) {
    const url = new URL(value);
    if (url.host !== host || url.protocol !== 'https:' || url.search || url.hash || !url.pathname.endsWith('/'))
      throw Error(`Unexpected sitemap URL: ${value}`);
    current[value] = hash(await readFile(`dist${url.pathname}index.html`, 'utf8'));
  }
  let previous = { pages: {}, submittedAt: 0 };
  try { previous = JSON.parse(await readFile('.indexnow/state.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const urlList = changedUrls(previous.pages, current);
  const keyLocation = `https://${host}/${key}.txt`;
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ host, urlList }, null, 2));
    return;
  }
  if (!urlList.length) {
    console.log('IndexNow: no changed sitemap pages; nothing submitted.');
    return;
  }
  // Confirm the production deployment, not a preview or stale build, before notifying Bing.
  for (let attempt = 0; ; attempt++) {
    try {
      const keyResponse = await fetch(keyLocation, { signal: AbortSignal.timeout(30000) });
      if (keyResponse.status !== 200 || (await keyResponse.text()).trim() !== key) throw Error('Ownership key is not live');
      for (const url of urlList) {
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
        if (current[url]) {
          if (response.status !== 200 || hash(await response.text()) !== current[url]) throw Error(`Build not live: ${url}`);
        } else if (![301,302,307,308,404,410].includes(response.status)) {
          throw Error(`Removed page still returns ${response.status}: ${url}`);
        }
      }
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await delay(10000);
    }
  }
  await delay(Math.max(0, previous.submittedAt + 300000 - Date.now()));
  const receipt = await submit({ host, key, keyLocation, urlList });
  const message = `IndexNow: Bing HTTP ${receipt.status} — ${receipt.pending ? 'received; key validation pending' : 'received'}. This is not an indexing guarantee.`;
  const report = `${message}\n\n${urlList.map(url => `- ${url}`).join('\n')}\n`;
  console.log(report);
  await mkdir('.indexnow', { recursive: true });
  await writeFile('.indexnow/receipt.json', JSON.stringify({ ...receipt, host, urlList, submittedAt: new Date().toISOString() }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
  // Save only after receipt, so an API failure remains eligible on the next deployment.
  await writeFile('.indexnow/state.json', JSON.stringify({ pages: current, submittedAt: Date.now() }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
