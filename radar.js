// Job Radar — quét 2 nhóm: (A) việc LẬP TRÌNH (.NET ⭐ + backend/fullstack),
// (B) việc PART-TIME/freelance buổi tối (tech làm được). Sort LƯƠNG cao lên đầu.
// Nguồn: 5 job-board public (API mở). Không phụ thuộc package (fetch built-in Node 18+).
const fs = require('fs');

const STRONG_RE = /(\.net|dotnet|c#|c\ssharp|asp\.?net|blazor)/i;                          // .NET rõ -> ⭐
const PROG_RE   = /(back[\s-]?end|full[\s-]?stack|software (engineer|developer)|web developer|platform engineer|\.net|c#|asp\.?net|blazor|\bapi\b)/i; // việc lập trình
const DOABLE_RE = /(developer|engineer|software|back[\s-]?end|front[\s-]?end|full[\s-]?stack|\.net|c#|asp|\bapi\b|web dev|data|database|\bsql\b|python|javascript|typescript|node|react|automation|script|\bqa\b|tester|technical writ|content writ|wordpress|php)/i; // tech bạn+AI làm được
const PART_RE   = /(part[\s-]?time|contract|freelance|temporary|hourly|c2h|part\b)/i;      // part-time/freelance

const SEEN_FILE = 'seen.json';
const MAX_LIST = 60;

async function safeJson(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'job-radar (personal digest)' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const kfmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;

async function jobicy() {
  const d = await safeJson('https://jobicy.com/api/v2/remote-jobs?count=50');
  if (!d || !Array.isArray(d.jobs)) return [];
  return d.jobs.map(x => {
    const min = num(x.annualSalaryMin), max = num(x.annualSalaryMax);
    return {
      title: x.jobTitle, company: x.companyName, url: x.url, location: x.jobGeo || 'Remote',
      source: 'Jobicy', type: (x.jobType || []).join(' '), tags: '',
      pay: max || min, payText: (min || max) ? `${kfmt(min || max)}–${kfmt(max || min)}` : '',
    };
  });
}
async function remoteok() {
  const d = await safeJson('https://remoteok.com/api');
  if (!Array.isArray(d)) return [];
  return d.filter(x => x && x.position).map(x => {
    const min = num(x.salary_min), max = num(x.salary_max);
    return {
      title: x.position, company: x.company, url: x.url, location: x.location || 'Remote',
      source: 'RemoteOK', type: '', tags: (x.tags || []).join(' '),
      pay: max || min, payText: (min || max) ? `${kfmt(min || max)}–${kfmt(max || min)}` : '',
    };
  });
}
async function remotive() {
  const d = await safeJson('https://remotive.com/api/remote-jobs?category=software-dev');
  if (!d || !Array.isArray(d.jobs)) return [];
  return d.jobs.map(x => ({
    title: x.title, company: x.company_name, url: x.url,
    location: x.candidate_required_location || 'Remote', source: 'Remotive',
    type: x.job_type || '', tags: (x.tags || []).join(' '),
    pay: 0, payText: (x.salary || '').trim(),
  }));
}
async function arbeitnow() {
  const d = await safeJson('https://www.arbeitnow.com/api/job-board-api');
  if (!d || !Array.isArray(d.data)) return [];
  return d.data.map(x => ({
    title: x.title, company: x.company_name, url: x.url,
    location: x.location || (x.remote ? 'Remote' : ''), source: 'Arbeitnow',
    type: (x.job_types || []).join(' '), tags: (x.tags || []).join(' '),
    pay: 0, payText: '',
  }));
}
async function himalayas() {
  const d = await safeJson('https://himalayas.app/jobs/api?limit=50');
  if (!d || !Array.isArray(d.jobs)) return [];
  return d.jobs.map(x => {
    const min = num(x.minSalary), max = num(x.maxSalary);
    return {
      title: x.title, company: x.companyName, url: x.applicationLink || x.guid,
      location: (x.locationRestrictions && x.locationRestrictions.join(', ')) || 'Remote',
      source: 'Himalayas', type: x.employmentType || '', tags: '',
      pay: max || min, payText: (min || max) ? `${kfmt(min || max)}–${kfmt(max || min)}` : '',
    };
  });
}

(async () => {
  const all = [].concat(...(await Promise.all([jobicy(), remoteok(), remotive(), arbeitnow(), himalayas()])));

  const enrich = (j) => {
    const hay = `${j.title} ${j.type} ${j.tags}`;
    const net = STRONG_RE.test(j.title || '');
    const prog = net || PROG_RE.test(j.title || '');
    const part = PART_RE.test(hay) && DOABLE_RE.test(j.title || '');
    return { ...j, net, prog, part };
  };
  const matched = all
    .filter(j => j.url)
    .map(enrich)
    .filter(j => j.prog || j.part);   // (A) lập trình hoặc (B) part-time tech

  const seen = fs.existsSync(SEEN_FILE) ? JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')) : [];
  const seenSet = new Set(seen);
  const fresh = [];
  for (const j of matched) {
    if (seenSet.has(j.url)) continue;
    seenSet.add(j.url);
    fresh.push(j);
  }
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seenSet].slice(-5000)));

  // Sort: LƯƠNG cao lên đầu; job không lương -> ưu tiên .NET ⭐ rồi part-time.
  fresh.sort((a, b) => (b.pay - a.pay) || ((b.net ? 1 : 0) - (a.net ? 1 : 0)) || ((b.part ? 1 : 0) - (a.part ? 1 : 0)));

  const netCount = fresh.filter(j => j.net).length;
  const partCount = fresh.filter(j => j.part).length;
  const list = fresh.slice(0, MAX_LIST);

  let md = `## 📡 Job Radar — ${fresh.length} job mới (⭐ ${netCount} .NET · 🌙 ${partCount} part-time · còn lại lập trình)\n\n`;
  if (fresh.length === 0 && process.env.FORCE_TEST === 'true') {
    md += '_(Issue TEST — lúc này không có job mới. Nhận được email này ⇒ đường thông báo OK. Xoá thoải mái.)_';
  } else if (fresh.length === 0) {
    md += '_Lúc này không có job mới khớp._';
  } else {
    md += list.map(j => {
      const flag = (j.net ? '⭐ ' : '') + (j.part ? '🌙 ' : '');
      const pay = j.payText ? ` · 💰 ${j.payText}` : '';
      return `- ${flag}[${j.title}](${j.url}) — **${j.company || '?'}** · ${j.location || 'Remote'}${pay} _(${j.source})_`;
    }).join('\n');
    if (fresh.length > MAX_LIST) md += `\n\n_…và ${fresh.length - MAX_LIST} job nữa (đã lưu)._`;
  }
  md += `\n\n---\n⭐ .NET · 🌙 part-time/freelance · 💰 lương (nếu có). Nguồn: Jobicy · RemoteOK · Remotive · Arbeitnow · Himalayas — auto GitHub Actions.`;
  fs.writeFileSync('digest.md', md);

  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `count=${fresh.length}\n`);
  console.log(`Total ${all.length}, matched ${matched.length}, fresh ${fresh.length} (⭐${netCount} 🌙${partCount})`);
})();
