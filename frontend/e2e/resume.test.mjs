import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function loadParserModule(name, imports = {}) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const result = {};
  new Function("exports", "require", outputText)(result, (id) => imports[id]);
  return result;
}

const { suggestResumeDetails } = loadParserModule("resume", { "./portfolio": loadParserModule("portfolio") });

test("keeps project bullets and joins only indented wraps", () => {
  const result = suggestResumeDetails([
    { text: "Projects" },
    { text: "Trip2gether", indent: 20 },
    { text: "• Built a shared itinerary — with conflict warnings", indent: 22 },
    { text: "for overlapping bookings.", indent: 34 },
    { text: "▪ Added polls • Saved draft plans", indent: 22 },
    { text: "Film Foodie | A movie night planner", indent: 20 },
    { text: "Demo", urls: ["https://example.com/film"] },
  ]);
  assert.deepEqual(result.projects.map(({ title }) => title), ["Trip2gether", "Film Foodie"]);
  assert.equal(result.projects[0].description, "• Built a shared itinerary — with conflict warnings for overlapping bookings.\n• Added polls\n• Saved draft plans");
  assert.equal(result.projects[1].url, "https://example.com/film");
});

test("keeps work bullets and summary paragraphs without treating dates inside bullets as jobs", () => {
  const result = suggestResumeDetails(`Alex Morgan
Summary
First line of the introduction.
Another deliberate line.

Second paragraph.

Work Experience
Signal Studio Inc. | Software Engineer | Remote | May 2024 – Aug. 2025
- Improved the 2025 dashboard
  with a new release workflow.
2. Automated deployment checks

• Trained new contributors.
Another Labs | Designer | 2026
• Redesigned the editor.`);
  assert.equal(result.bio, "First line of the introduction.\nAnother deliberate line.\n\nSecond paragraph.");
  assert.equal(result.experience.length, 2);
  assert.equal(result.experience[0].company, "Signal Studio Inc.");
  assert.equal(result.experience[0].description,
    "• Improved the 2025 dashboard with a new release workflow.\n• Automated deployment checks\n\n• Trained new contributors.");
});
