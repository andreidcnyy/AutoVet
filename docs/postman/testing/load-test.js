// Load test: simulated clinic staff using the admin dashboard at the same time.
//
// Each virtual user (VU) logs in with a real account, then repeatedly:
//   1. opens the dashboard - the same 6 API calls the dashboard page makes,
//      sent in parallel as the browser does (this is the "dashboard load time");
//   2. opens one other feature page (appointments, inventory, clients, pets, invoices);
//   3. pauses 4-6 s, like a person reading the screen.
//
// Usage: node load-test.js [vus=30] [seconds=30] [threshold_ms=3000]
// Env:   BASE_URLS (comma-separated workers), PASSWORD, ACCOUNTS (comma-separated emails)
const VUS = Number(process.argv[2] || 30);
const DURATION_S = Number(process.argv[3] || 30);
const THRESHOLD_MS = Number(process.argv[4] || 3000);
const BASES = (process.env.BASE_URLS || "http://127.0.0.1:8010").split(",");
const PASSWORD = process.env.PASSWORD || "password123";
const ACCOUNTS = (process.env.ACCOUNTS || "admin@autovet.com").split(",");

const DASHBOARD = [
  "/api/dashboard/summary",
  "/api/dashboard/appointments/today",
  "/api/dashboard/appointments/upcoming",
  "/api/dashboard/notifications",
  "/api/dashboard/inventory-forecast",
  "/api/dashboard/appointment-forecast",
];
const PAGES = ["/api/appointments", "/api/inventory", "/api/owners", "/api/pets", "/api/invoices"];

const reqTimes = [];
const pageTimes = [];
let ok = 0, failed = 0, bytes = 0, iterations = 0;
const statusCounts = {};
let rr = 0;
const base = () => BASES[rr++ % BASES.length];

async function call(path, token) {
  const t0 = performance.now();
  try {
    const res = await fetch(base() + path, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    const body = await res.arrayBuffer();
    const ms = performance.now() - t0;
    bytes += body.byteLength;
    reqTimes.push(ms);
    statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
    res.ok ? ok++ : failed++;
    return ms;
  } catch (e) {
    failed++;
    statusCounts.error = (statusCounts.error || 0) + 1;
    return performance.now() - t0;
  }
}

async function login(email) {
  const res = await fetch(BASES[0] + "/api/login", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`login failed for ${email}: ${res.status}`);
  return body.token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function vu(token, endAt) {
  while (Date.now() < endAt) {
    const t0 = performance.now();
    await Promise.all(DASHBOARD.map((p) => call(p, token)));
    pageTimes.push(performance.now() - t0);
    await call(PAGES[Math.floor(Math.random() * PAGES.length)], token);
    iterations++;
    await sleep(4000 + Math.random() * 2000);
  }
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] || 0;
};
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const f = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(2)}ms`);
const stat = (a) =>
  `avg=${f(avg(a))} min=${f(Math.min(...a))} med=${f(pct(a, 50))} max=${f(Math.max(...a))} p(90)=${f(pct(a, 90))} p(95)=${f(pct(a, 95))}`;

(async () => {
  const tokens = [];
  for (const email of ACCOUNTS) tokens.push(await login(email.trim()));

  console.log(`\n  AutoVet load test`);
  console.log(`  scenario: ${VUS} virtual users for ${DURATION_S}s against ${BASES.length} PHP worker(s), ${tokens.length} staff accounts`);
  console.log(`  each iteration: open dashboard (${DASHBOARD.length} parallel API calls) + 1 feature page, then 4-6s think time\n`);

  const start = Date.now();
  const endAt = start + DURATION_S * 1000;
  await Promise.all(Array.from({ length: VUS }, (_, i) => sleep(i * 100).then(() => vu(tokens[i % tokens.length], endAt))));
  const elapsed = (Date.now() - start) / 1000;

  const total = ok + failed;
  const pass95 = pct(pageTimes, 95) < THRESHOLD_MS;
  const failRate = failed / (total || 1);
  const mark = (b) => (b ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m");

  console.log(`  \x1b[1mTHRESHOLDS\x1b[0m`);
  console.log(`    dashboard_load_time`);
  console.log(`    ${mark(pass95)} 'p(95)<${THRESHOLD_MS}ms' p(95)=${f(pct(pageTimes, 95))}`);
  console.log(`    http_req_failed`);
  console.log(`    ${mark(failRate < 0.01)} 'rate<0.01' rate=${(failRate * 100).toFixed(2)}%\n`);
  console.log(`  \x1b[1mTOTAL RESULTS\x1b[0m`);
  console.log(`    dashboard_load_time.......: ${stat(pageTimes)}`);
  console.log(`    dashboard_loads...........: ${pageTimes.length}`);
  console.log(`    http_req_duration.........: ${stat(reqTimes)}`);
  console.log(`    http_reqs.................: ${total}  ${(total / elapsed).toFixed(2)}/s`);
  console.log(`    http_req_failed...........: ${(failRate * 100).toFixed(2)}%  ${failed} out of ${total}`);
  console.log(`    status codes..............: ${Object.entries(statusCounts).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`    iterations................: ${iterations}`);
  console.log(`    vus.......................: ${VUS}`);
  console.log(`    data_received.............: ${(bytes / 1024 / 1024).toFixed(1)} MB  ${(bytes / 1024 / elapsed).toFixed(0)} kB/s`);
  console.log(`\n  running (${elapsed.toFixed(1)}s), ${VUS}/${VUS} VUs, ${iterations} complete iterations\n`);
  process.exit(pass95 && failRate < 0.01 ? 0 : 1);
})();
