// Job Radar — tổng hợp job .NET remote từ các job-board public (API/RSS mở),
// lọc theo từ khoá, khử trùng lặp, xuất digest.md để workflow tạo GitHub Issue.
// Không phụ thuộc package ngoài (dùng fetch built-in của Node 18+).
const fs = require('fs');

// Lọc theo TIÊU ĐỀ (chính xác cao) cho các nguồn "rộng"; nguồn đã query sẵn tag .NET (pre=true) thì nhận hết.
const TITLE_RE = /(\.net|dotnet|c#|c\ssharp|asp\.?net|blazor)/i;
const SEEN_FILE = 'seen.json';
const MAX_LIST = 50;

async function safeJson(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'job-radar (personal digest)' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// --- Nguồn đã lọc sẵn .NET (nhận toàn bộ) ---
async function jobicy() {
  const d = await safeJson('https://jobicy.com/api/v2/remote-jobs?count=50&tag=dotnet');
  if (!d || !Array.isArray(d.jobs)) return [];
  return d.jobs.map(x => ({
    title: x.jobTitle, company: x.companyName, url: x.url,
    location: x.jobGeo || 'Remote', source: 'Jobicy', pre: true,
  }));
}

// --- Nguồn rộng (lọc theo tiêu đề) ---
async function remoteok() {
  const d = await safeJson('https://remoteok.com/api');
  if (!Array.isArray(d)) return [];
  return d.filter(x => x && x.position).map(x => ({
    title: x.position, company: x.company, url: x.url,
    location: x.location || 'Remote', source: 'RemoteOK', pre: false,
  }));
}
async function remotive() {
  const d = await safeJson('https://remotive.com/api/remote-jobs?search=.net');
  if (!d || !Array.isArray(d.jobs)) return [];
  return d.jobs.map(x => ({
    title: x.title, company: x.company_name, url: x.url,
    location: x.candidate_required_location || 'Remote', source: 'Remotive', pre: false,
  }));
}
async function himalayas() {
  const d = await safeJson('https://himalayas.app/jobs/api?limit=50');
  if (!d || !Array.isArray(d.jobs)) return [];
  return d.jobs.map(x => ({
    title: x.title, company: x.companyName, url: x.applicationLink || x.guid,
    location: (x.locationRestrictions && x.locationRestrictions.join(', ')) || 'Remote', source: 'Himalayas', pre: false,
  }));
}
async function arbeitnow() {
  const d = await safeJson('https://www.arbeitnow.com/api/job-board-api');
  if (!d || !Array.isArray(d.data)) return [];
  return d.data.map(x => ({
    title: x.title, company: x.company_name, url: x.url,
    location: x.location || (x.remote ? 'Remote' : ''), source: 'Arbeitnow', pre: false,
  }));
}

(async () => {
  const all = [].concat(...(await Promise.all([jobicy(), remoteok(), remotive(), arbeitnow(), himalayas()])));
  const matched = all.filter(j => j.url && (j.pre || TITLE_RE.test(j.title || '')));

  const seen = fs.existsSync(SEEN_FILE) ? JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')) : [];
  const seenSet = new Set(seen);
  const fresh = [];
  for (const j of matched) {
    if (seenSet.has(j.url)) continue;
    seenSet.add(j.url);
    fresh.push(j);
  }
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seenSet].slice(-4000)));

  const list = fresh.slice(0, MAX_LIST);
  let md = `## 📡 Job Radar — ${fresh.length} job .NET/remote mới\n\n`;
  if (fresh.length === 0) {
    md += '_Hôm nay không có job mới khớp từ khoá._\n';
  } else {
    md += list.map(j =>
      `- [${j.title}](${j.url}) — **${j.company || '?'}** · ${j.location || 'Remote'} _(${j.source})_`
    ).join('\n');
    if (fresh.length > MAX_LIST) md += `\n\n_…và ${fresh.length - MAX_LIST} job nữa (đã lưu, tránh spam)._`;
  }
  md += `\n\n---\n_Nguồn: Jobicy · RemoteOK · Remotive · Arbeitnow · Himalayas — tự động bởi GitHub Actions._`;
  fs.writeFileSync('digest.md', md);

  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `count=${fresh.length}\n`);
  console.log(`Total ${all.length}, matched ${matched.length}, fresh ${fresh.length}`);
})();
