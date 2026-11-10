import { BASE, OUT, launch } from "./lib.mjs";
import { readFileSync } from "node:fs";

const LOG = process.env.E2E_BACKEND_LOG;
if (!LOG) throw new Error("Set E2E_BACKEND_LOG to the file the backend writes its log to. See e2e/README.md.");
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " â€” " + extra : ""}`);

const stamp = Date.now().toString().slice(-7);
const EMAIL = `portfolabs.e2e.${stamp}@gmail.com`;
const PASSWORD = "Correct-Horse-Battery-9!";
const SLUG = `e2e-signup-${stamp}`;

/** The newest verification code the backend "emailed" to this address (dev mode logs instead of sending). */
function latestCode(email, subjectPart) {
  const lines = readFileSync(LOG, "utf8").split("\n").filter((line) => line.includes(`DEV EMAIL to ${email}`) && line.includes(subjectPart));
  const match = lines.at(-1)?.match(/\|\s*(\d{6})\s*$/);
  return match?.[1];
}

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

async function fillRegister(email, password = PASSWORD) {
  await page.goto(`${BASE}/auth?step=register`);
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Send verification code" }).click();
}

try {
  // ---- addresses that should be refused
  await fillRegister("someone@mailinator.com");
  await page.getByText(/permanent email address/i).waitFor({ timeout: 20000 });
  check("a throwaway-inbox address (mailinator) is refused with a clear message", true);

  await fillRegister(`someone${stamp}@gmial-typo-${stamp}.com`);
  await page.getByText(/couldn.t verify that email address/i).waitFor({ timeout: 30000 });
  check("a domain that can't receive mail is refused (real DNS lookup)", true);

  await page.goto(`${BASE}/auth?step=register`);
  await page.getByLabel("Password", { exact: true }).fill("short");
  const tooShort = await page.getByLabel("Password", { exact: true }).evaluate((el) => !el.validity.valid);
  check("a too-short password is blocked in the form", tooShort);

  // ---- real sign-up with a real-looking address
  await fillRegister(EMAIL);
  await page.waitForURL("**/auth?step=verify", { timeout: 30000 });
  check("sign-up moves on to the verification step", true);

  const code = latestCode(EMAIL, "Verify your Portfolabs email");
  check("a six-digit code was sent to the address", /^\d{6}$/.test(code ?? ""), code ? "code found" : "no code found");

  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Verification code").fill(wrong);
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.getByText(/incorrect, expired, or out of attempts/i).waitFor({ timeout: 15000 });
  check("a wrong code is rejected", true);

  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.getByText("Your portfolios").first().waitFor();
  check("the right code creates the account and signs in", true);

  // ---- use the account: create + publish a portfolio
  await page.getByRole("button", { name: "New portfolio" }).click();
  await page.getByLabel("Your name").fill("E2E Tester");
  await page.getByLabel("Web address").fill(SLUG);
  await page.getByRole("button", { name: /create and start editing/i }).click();
  await page.waitForURL(`**/editor/${SLUG}`, { timeout: 20000 });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText(/Published\./).waitFor({ timeout: 20000 });
  const live = await context.request.get(`${BASE}/p/${SLUG}`);
  check("the new account can publish a portfolio", live.status() === 200 && /E2E Tester/.test(await live.text()));

  // ---- sign out, sign back in with the password
  await page.goto(`${BASE}/auth`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: /^sign in$/i }).waitFor({ timeout: 15000 });
  await page.goto(`${BASE}/dashboard`);
  await page.getByText(/Sign in to build/i).waitFor({ timeout: 15000 });
  check("sign out works (the dashboard asks for sign-in again)", true);

  await page.goto(`${BASE}/auth`);
  await page.getByLabel(/email/i).fill(EMAIL.toUpperCase());
  await page.getByLabel(/password/i).first().fill("wrong-password-123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByText(/Email or password is incorrect/i).waitFor({ timeout: 15000 });
  check("a wrong password is refused with a generic message", true);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  check("signing in again with the password works (email is case-insensitive)", true);

  // ---- delete the account: pages must vanish immediately
  await page.waitForTimeout(32000); // a new code can only be requested every 30 seconds
  await page.goto(`${BASE}/auth?step=delete`);
  await page.getByRole("button", { name: "Send deletion code" }).click();
  await page.waitForURL("**/auth?step=delete-confirm", { timeout: 30000 });
  const deleteCode = latestCode(EMAIL, "Confirm deletion");
  await page.getByLabel("Verification code").fill(deleteCode);
  await page.getByRole("button", { name: "Permanently delete account" }).click();
  await page.getByText(/account has been deleted/i).waitFor({ timeout: 20000 });
  check("the account can be deleted with an emailed code", true);

  const gone = await context.request.get(`${BASE}/p/${SLUG}`);
  check("its public page disappears immediately (cache cleared)", /Nothing here yet/.test(await gone.text()));

  // ---- the old address can't be taken over, and the account really is gone
  const signIn = await context.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD }, headers: { origin: BASE } });
  check("the deleted account can no longer sign in", signIn.status() === 401, String(signIn.status()));
} catch (error) {
  check("flow completed without an unexpected error", false, String(error).split("\n")[0]);
  await page.screenshot({ path: `${OUT}/failure3.png` });
} finally {
  await browser.close();
}

console.log(results.join("\n"));
const real = errors.filter((text) => !/favicon|Download the React DevTools|400 \(Bad Request\)|401 \(Unauthorized\)|404 \(Not Found\)|422 \(Unprocessable|ERR_NAME_NOT_RESOLVED/i.test(text));
console.log(real.length ? `\nBrowser console errors:\n${[...new Set(real)].slice(0, 8).join("\n")}` : "\nNo unexpected browser console errors.");

