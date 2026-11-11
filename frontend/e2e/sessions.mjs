import { BASE, OUT, launch } from "./lib.mjs";

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
const stamp = Date.now().toString().slice(-6);
const OLD = `tabs-old-${stamp}`;
const NEW = `tabs-new-${stamp}`;

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errors = [];
const login = await context.newPage();
login.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

try {
  await login.goto(`${BASE}/auth`);
  await login.getByLabel(/email/i).fill("tester@portfolabs.dev");
  await login.getByLabel(/password/i).first().fill("Portfolabs-Test-2026!");
  await login.getByRole("button", { name: /^sign in$/i }).click();
  await login.waitForURL("**/dashboard");

  const api = (method, path, data) => context.request.fetch(`${BASE}/api/portfolios${path}`, { method, data, headers: { origin: BASE } });
  const draft = { template_id: "editorial", name: "Tabs Test", headline: "Start", bio: "", projects: [], links: [] };
  check("test portfolio created", (await api("POST", "", { slug: OLD, draft_content: draft })).status() === 201);
  await api("POST", `/${OLD}/publish`);

  // ---- two tabs
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  for (const tab of [tabA, tabB]) { await tab.goto(`${BASE}/editor/${OLD}`); await tab.getByLabel("Headline").waitFor({ timeout: 20000 }); }

  await tabA.getByLabel("Headline").fill("Written in tab A");
  await tabA.getByRole("button", { name: "Save draft" }).click();
  await tabA.getByText("Draft saved.").waitFor({ timeout: 15000 });
  check("tab A saves normally", true);

  await tabB.getByLabel("Headline").fill("Written in tab B");
  await tabB.getByRole("button", { name: "Save draft" }).click();
  await tabB.getByText(/changed in another tab or device/i).waitFor({ timeout: 15000 });
  check("tab B is stopped from overwriting tab A's newer work", true);

  const saved = await (await api("GET", `/${OLD}`)).json();
  check("tab A's text is the one that was kept", saved.draft_content.headline === "Written in tab A");

  await tabB.getByRole("button", { name: "Load the latest version" }).click();
  await tabB.getByText("Loaded the latest version.").waitFor({ timeout: 15000 });
  check("tab B can load the latest version", (await tabB.getByLabel("Headline").inputValue()) === "Written in tab A");

  await tabB.getByLabel("Headline").fill("Fixed in tab B");
  await tabB.getByRole("button", { name: "Save draft" }).click();
  await tabB.getByText("Draft saved.").waitFor({ timeout: 15000 });
  check("after reloading, tab B can save again", true);

  // ---- renaming
  await tabB.getByRole("button", { name: "Publish changes" }).click();
  await tabB.getByText(/Published\./).waitFor({ timeout: 15000 });
  const addressField = tabB.getByLabel("Web address");
  await addressField.fill(NEW);
  await tabB.getByRole("button", { name: "Change address" }).click();
  await tabB.waitForURL(`**/editor/${NEW}`, { timeout: 20000 });
  check("changing the address opens the editor at the new address", true);

  const visitor = await context.newPage();
  await visitor.goto(`${BASE}/p/${NEW}`);
  await visitor.getByText("Tabs Test").first().waitFor({ timeout: 20000 });
  check("the portfolio is live at the new address", true);

  await visitor.goto(`${BASE}/p/${OLD}`);
  await visitor.waitForURL(`**/p/${NEW}`, { timeout: 20000 });
  await visitor.getByText("Tabs Test").first().waitFor({ timeout: 20000 });
  check("the old link sends visitors to the new address", true);

  const taken = await api("PATCH", `/${NEW}/address`, { slug: "admin" });
  check("reserved addresses can't be chosen", taken.status() === 409, String(taken.status()));

  const stranger = await browser.newContext();
  const claim = await stranger.request.post(`${BASE}/api/portfolios`, { data: { slug: OLD, draft_content: draft }, headers: { origin: BASE } });
  check("signed-out visitors can't claim the old address", claim.status() === 401, String(claim.status()));
} catch (error) {
  check("flow completed without an unexpected error", false, String(error).split("\n")[0]);
  await login.screenshot({ path: `${OUT}/failure4.png` });
} finally {
  await context.request.fetch(`${BASE}/api/portfolios/${NEW}`, { method: "DELETE", headers: { origin: BASE } }).catch(() => {});
  await context.request.fetch(`${BASE}/api/portfolios/${OLD}`, { method: "DELETE", headers: { origin: BASE } }).catch(() => {});
  await browser.close();
}

console.log(results.join("\n"));
const real = errors.filter((text) => !/favicon|401 \(Unauthorized\)|404 \(Not Found\)|409 \(Conflict\)|Content Security|Refused/i.test(text));
const csp = errors.filter((text) => /Content Security|Refused/i.test(text));
console.log(csp.length ? `\nSecurity policy blocked something:\n${csp.slice(0, 5).join("\n")}` : "\nNothing was blocked by the security policy.");
console.log(real.length ? `Browser console errors:\n${[...new Set(real)].slice(0, 6).join("\n")}` : "No unexpected browser console errors.");
