import { BASE, OUT, launch, makeImages } from "./lib.mjs";

makeImages();
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " â€” " + extra : ""}`); };

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

try {
  // Signed out: dashboard asks for sign-in
  await page.goto(`${BASE}/dashboard`);
  await page.getByText(/Sign in to build your portfolio/i).waitFor({ timeout: 20000 });
  check("dashboard asks signed-out visitors to sign in", true);

  // Sign in through the real form
  await page.goto(`${BASE}/auth`);
  await page.getByLabel(/email/i).fill("tester@portfolabs.dev");
  await page.getByLabel(/password/i).first().fill("Portfolabs-Test-2026!");
  await page.screenshot({ path: `${OUT}/01-auth.png` });
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.getByText("Your portfolios").first().waitFor();
  check("login lands on the dashboard", true);
  await page.getByText("Alex Morgan").first().waitFor();
  check("dashboard lists the seeded portfolio", true);
  await page.screenshot({ path: `${OUT}/02-dashboard.png` });

  // Create a new portfolio
  await page.getByRole("button", { name: "New portfolio" }).click();
  await page.getByLabel("Your name").fill("Sam Rivera");
  const slugValue = await page.getByLabel("Web address").inputValue();
  check("address auto-fills from the name", slugValue === "sam-rivera", slugValue);
  await page.getByLabel("Web address").fill("sam-e2e-" + Date.now().toString().slice(-5));
  const slug = await page.getByLabel("Web address").inputValue();
  await page.getByText("Terminal", { exact: true }).click();
  await page.screenshot({ path: `${OUT}/03-create.png` });
  await page.getByRole("button", { name: /create and start editing/i }).click();
  await page.waitForURL(`**/editor/${slug}`, { timeout: 20000 });
  check("creating a portfolio opens the editor", true);

  // Editor: fill in details
  await page.getByLabel("Headline").fill("Data scientist & tinkerer");
  await page.getByLabel("Bio").fill("I turn messy data into clear answers.\n\nCurrently learning Rust.");
  await page.getByRole("button", { name: "Add a project" }).click();
  await page.getByLabel("Title").fill("Rain Radar");
  await page.getByLabel("Description").first().fill("Predicts rain 10 minutes ahead using open weather data.");
  await page.getByLabel(/Link \(optional\)/).fill("https://example.com/rain");
  await page.getByRole("button", { name: "Add a link" }).click();
  await page.getByLabel("Label").fill("GitHub");
  await page.locator('input[type="url"]').last().fill("https://github.com/example");
  await page.waitForTimeout(1200);

  // Image uploads: a fake file is refused, a real photo is accepted
  const PHOTO = OUT + "/photo.png";
  const FAKE = OUT + "/fake.png";
  await page.locator('input[type="file"]').first().setInputFiles(FAKE);
  await page.getByText(/couldn.t be read as an image|valid image|JPEG, PNG or WebP/i).first().waitFor({ timeout: 15000 });
  check("a fake image file is refused with a clear message", true);
  await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Replace image" }).first().waitFor({ timeout: 20000 });
  check("profile photo uploads", true);
  await page.locator('input[type="file"]').nth(1).setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Replace image" }).nth(1).waitFor({ timeout: 20000 });
  check("project image uploads", true);
  // Live preview updates inside the iframe
  const preview = page.frameLocator('iframe[title="Portfolio preview"]');
  await preview.getByText("Rain Radar").first().waitFor({ timeout: 15000 });
  check("live preview shows what you type", true);
  await preview.getByText("Data scientist & tinkerer").first().waitFor();
  await page.screenshot({ path: `${OUT}/04-editor.png` });

  // Mobile preview width
  await page.getByRole("button", { name: "Mobile" }).click();
  await page.waitForTimeout(500);
  const width = await page.locator('iframe[title="Portfolio preview"]').evaluate((el) => el.getBoundingClientRect().width);
  check("mobile preview is 390px wide", Math.round(width) === 390, String(Math.round(width)));
  await page.getByRole("button", { name: "Desktop" }).click();

  // Switching template changes the preview
  await page.locator("label", { hasText: "Aurora" }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/05-aurora-preview.png` });

  // Validation: half-filled project is rejected with a clear message
  await page.getByRole("button", { name: "Add a project" }).click();
  await page.getByLabel("Description").nth(1).fill("No title here");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText(/Project 2 needs a title/i).waitFor();
  check("half-finished project is rejected with a clear message", true);
  await page.locator("fieldset", { hasText: "Project 2" }).getByRole("button", { name: "Remove", exact: true }).click();

  // Publish
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText(/Published\. Your changes are live/i).waitFor({ timeout: 20000 });
  check("publish succeeds", true);

  // The stored image is a small WebP served from storage
  const previewImg = page.frameLocator('iframe[title="Portfolio preview"]').locator("img").first();
  await previewImg.waitFor({ timeout: 15000 });
  const imgSrc = await previewImg.getAttribute("src");
  const imgResponse = await context.request.get(imgSrc);
  const type = imgResponse.headers()["content-type"];
  check("stored image is served as WebP", imgResponse.status() === 200 && /webp/.test(type), `${imgResponse.status()} ${type} ${(await imgResponse.body()).length} bytes`);
  // Public page
  const publicPage = await context.newPage();
  const response = await publicPage.goto(`${BASE}/p/${slug}`);
  await publicPage.getByText("Rain Radar").first().waitFor({ timeout: 20000 });
  check("public page renders the published portfolio", response.status() === 200);
  const publicImages = await publicPage.locator("img").evaluateAll((els) => els.map((el) => el.src));
  check("public page shows the uploaded images", publicImages.length >= 2 && publicImages.every((src) => /\/media\/u\d+\//.test(src)), String(publicImages.length) + " images");
  await publicPage.screenshot({ path: `${OUT}/06-public.png`, fullPage: false });

  // Draft edits stay private until republished
  await page.getByLabel("Name").first().fill("Sam Rivera (edited)");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved.").waitFor();
  await publicPage.reload();
  const stillOld = await publicPage.getByText("(edited)").count();
  check("draft edits stay private until republished", stillOld === 0);
  await page.getByRole("button", { name: "Publish changes" }).click();
  await page.getByText(/Published\./).waitFor();
  await publicPage.reload();
  await publicPage.getByText("(edited)").first().waitFor({ timeout: 15000 });
  check("republishing updates the same link instantly", true);

  // Take offline then delete from the dashboard
  await page.getByRole("button", { name: "Take it offline" }).click();
  await page.getByText(/no longer public/i).waitFor();
  await publicPage.goto(`${BASE}/p/${slug}`);
  await publicPage.getByText(/Nothing here yet/i).waitFor({ timeout: 15000 });
  check("unpublished portfolio is no longer visible", true);

  await page.goto(`${BASE}/dashboard`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("listitem").filter({ hasText: slug }).getByRole("button", { name: "Delete" }).click();
  await page.waitForTimeout(800);
  check("delete removes it from the dashboard", (await page.getByText(`/p/${slug}`).count()) === 0);

  // Another visitor (no cookies) cannot call the API
  const anon = await browser.newContext();
  const apiResponse = await anon.request.get(`${BASE}/api/portfolios`);
  check("signed-out API call is refused", apiResponse.status() === 401, String(apiResponse.status()));
} catch (error) {
  check("flow completed without an unexpected error", false, String(error).split("\n")[0]);
  await page.screenshot({ path: `${OUT}/failure.png` });
} finally {
  await browser.close();
}

console.log(results.join("\n"));
const real = errors.filter((text) => !/favicon|Download the React DevTools|401 \(Unauthorized\)|404 \(Not Found\)/i.test(text));
console.log(real.length ? `\nBrowser console errors:\n${[...new Set(real)].slice(0, 8).join("\n")}` : "\nNo unexpected browser console errors.");



