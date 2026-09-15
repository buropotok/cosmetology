import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createSoloImageHistory } from "./before-after/solo-image-history.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");

test("solo history keeps independent geometry for every thumbnail", () => {
  const revoked = [];
  const history = createSoloImageHistory({
    createUrl: (file) => `blob:${file.name}`,
    revokeUrl: (url) => revoked.push(url),
  });
  history.initialize({ name: "original" }, { ratio: "4/5", x: 4, y: 5, scale: 1.2, rotation: 10, fitted: true });
  history.append({ name: "v1" }, { ratio: "1/1", x: 7, y: 8, scale: 1.4, rotation: -15, fitted: true });
  history.select(0);
  history.updateActiveGeometry({ ratio: "4/5", x: 40, y: 50, scale: 2, rotation: 25, fitted: true });
  assert.deepEqual(history.get(0).geometry, { ratio: "4/5", cropHeight: null, x: 40, y: 50, scale: 2, rotation: 25, fitted: true });
  assert.deepEqual(history.get(1).geometry, { ratio: "1/1", cropHeight: null, x: 7, y: 8, scale: 1.4, rotation: -15, fitted: true });
  assert.equal(history.undo, undefined);
  assert.equal(history.redo, undefined);
  history.destroy();
  assert.deepEqual(revoked, ["blob:original", "blob:v1"]);
});

test("solo AI owns cancellation and commits history only after a successful apply", () => {
  const source = read("./before-after/solo-ai.js");
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /await applyVersion\(file, null\)/);
  assert.match(source, /history\.append\(file, getGeometry\?\.\(\) \|\| null\)/);
  assert.ok(source.indexOf("await applyVersion(file, null)") < source.indexOf("history.append(file"));
  assert.match(source, /currentOperation !== operation/);
  assert.match(source, /applyVersion\(baseVersion\.file, baseVersion\.geometry\)/);
  assert.doesNotMatch(source, /instruction\.value\s*=/);
});

test("AI editing exports the visible photo without the shared watermark and restores per-version geometry", () => {
  const source = read("./before-after.js");
  assert.match(source, /getCurrentBlob: \(\) => composite\.photoBlob\(\)/);
  assert.match(source, /function captureSoloGeometry\(\)/);
  assert.match(source, /async function applySoloVersion\(fileValue, versionGeometry = null\)/);
  assert.match(source, /const sharedWatermark = state\.selectedWatermark/);
  assert.match(source, /state\.selectedWatermark = sharedWatermark/);
  assert.match(source, /versionGeometry\.rotation/);
});

test("AI controls are solo-only, use a dedicated pending overlay, and expose thumbnails without Undo or Redo", () => {
  const html = read("./before-after.html");
  const css = read("./before-after.css");
  const source = read("./before-after/solo-ai.js");
  const bridge = read("./before-after-bridge.js");
  assert.match(html, /Введите сюда пожелания для редактирования изображения/);
  assert.match(html, />Сгенерировать</);
  assert.match(html, /id="soloVersions"/);
  assert.match(html, /id="soloAiOverlay"/);
  assert.doesNotMatch(html, /soloUndo|soloRedo|>Undo<|>Redo</);
  assert.doesNotMatch(source, /#soloUndo|#soloRedo|\.undo\(|\.redo\(/);
  assert.match(source, /#soloAiOverlay/);
  assert.doesNotMatch(bridge, /soloAiOverlay/);
  assert.match(css, /\.solo-ai\{display:none/);
  assert.match(css, /body\[data-mode=solo\] \.solo-ai\{display:block\}/);
});
