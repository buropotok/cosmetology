import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createSoloImageHistory } from "./before-after/solo-image-history.js";

test("solo history appends without truncating and shares selection across thumbnails, undo, and redo", () => {
  const revoked = [],
    history = createSoloImageHistory({
      createUrl: (file) => `blob:${file.name}`,
      revokeUrl: (url) => revoked.push(url),
    });
  history.initialize({ name: "original" });
  history.append({ name: "v1" });
  history.append({ name: "v2" });
  assert.equal(history.select(1).file.name, "v1");
  assert.equal(history.undo().file.name, "original");
  assert.equal(history.redo().file.name, "v1");
  history.append({ name: "branch" });
  assert.deepEqual(
    history.snapshot().versions.map((item) => item.file.name),
    ["original", "v1", "v2", "branch"],
  );
  history.destroy();
  assert.deepEqual(revoked, [
    "blob:original",
    "blob:v1",
    "blob:v2",
    "blob:branch",
  ]);
});

test("solo AI owns cancellation, current rendered input, transient versions, and preserved instruction", () => {
  const source = fs.readFileSync(
    new URL("./before-after/solo-ai.js", import.meta.url),
    "utf8",
  );
  const bridge = fs.readFileSync(
    new URL("./before-after-bridge.js", import.meta.url),
    "utf8",
  );
  const controller = fs.readFileSync(
    new URL("./before-after-controller.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /getCurrentBlob\(\)/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /history\.append\(file\)/);
  assert.doesNotMatch(source, /instruction\.value\s*=/);
  assert.match(bridge, /mode!==['"]dual['"]\)return/);
  assert.match(controller, /replaceAt\(soloIndex,file\)/);
});

test("AI controls are solo-only and the dual flow remains unchanged", () => {
  const html = fs.readFileSync(
    new URL("./before-after.html", import.meta.url),
    "utf8",
  );
  const css = fs.readFileSync(
    new URL("./before-after.css", import.meta.url),
    "utf8",
  );
  assert.match(html, /Введите сюда пожелания для редактирования изображения/);
  assert.match(html, />Сгенерировать</);
  assert.match(css, /\.solo-ai\{display:none/);
  assert.match(css, /body\[data-mode=solo\] \.solo-ai\{display:block\}/);
});
