import { createSoloImageHistory } from "./solo-image-history.js";

export function createSoloAi({
  root,
  getCurrentBlob,
  getGeometry,
  applyVersion,
  authHeaders,
  showError,
}) {
  const history = createSoloImageHistory();
  const strip = root.querySelector("#soloVersions"),
    instruction = root.querySelector("#soloAiInstruction"),
    generate = root.querySelector("#soloAiGenerate");
  const overlay = root.querySelector("#soloAiOverlay"),
    stage = root.querySelector("#soloAiStage"),
    cancel = root.querySelector("#soloAiCancel");
  let controller = null,
    dotsTimer = 0,
    operation = 0,
    selecting = false;

  function render() {
    const value = history.snapshot();
    strip.replaceChildren(
      ...value.versions.map((version, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "solo-version";
        button.classList.toggle("selected", index === value.activeIndex);
        button.setAttribute("aria-label", `Выбрать вариант ${index + 1}`);
        const image = document.createElement("img");
        image.src = version.url;
        image.alt = "";
        button.append(image);
        button.onclick = () => void select(index);
        return button;
      }),
    );
  }

  function syncActiveGeometry() {
    history.updateActiveGeometry(getGeometry?.() || null);
  }

  async function select(index) {
    const previousIndex = history.snapshot().activeIndex;
    if (index === previousIndex || selecting) return;
    const version = history.get(index);
    if (!version) return;
    syncActiveGeometry();
    selecting = true;
    try {
      await applyVersion(version.file, version.geometry);
      history.select(index);
      render();
    } catch (error) {
      showError(error?.message || "Не удалось открыть выбранную версию.");
    } finally {
      selecting = false;
    }
  }

  function hideLoading() {
    if (dotsTimer) clearInterval(dotsTimer);
    dotsTimer = 0;
    overlay.hidden = true;
  }

  function showLoading() {
    let dots = 0;
    overlay.hidden = false;
    const tick = () => {
      dots = (dots % 3) + 1;
      stage.textContent = `Применяем изменения${".".repeat(dots)}`;
    };
    tick();
    dotsTimer = window.setInterval(tick, 450);
  }

  function showGenerationResult(success) {
    const webApp = window.Telegram?.WebApp;
    const popup = success
      ? {
          message: "Генерация завершена",
          buttons: [{ id: "continue", type: "default", text: "Продолжить" }],
        }
      : {
          message: "Генерация не удалась",
          buttons: [
            { id: "retry", type: "default", text: "Попробовать ещё раз" },
            { id: "cancel", type: "cancel", text: "Отмена" },
          ],
        };
    if (typeof webApp?.showPopup === "function") {
      return new Promise((resolve) => {
        try {
          webApp.showPopup(popup, (buttonId) =>
            resolve(buttonId || (success ? "continue" : "cancel")),
          );
        } catch {
          resolve(
            success
              ? "continue"
              : window.confirm("Генерация не удалась\n\nПопробовать ещё раз?")
                ? "retry"
                : "cancel",
          );
        }
      });
    }
    if (success) {
      window.alert("Генерация завершена");
      return Promise.resolve("continue");
    }
    return Promise.resolve(
      window.confirm("Генерация не удалась\n\nПопробовать ещё раз?")
        ? "retry"
        : "cancel",
    );
  }

  function abort() {
    operation += 1;
    if (controller) {
      controller.abort();
      controller = null;
    }
    hideLoading();
  }

  async function run(promptOverride) {
    const prompt =
      typeof promptOverride === "string" ? promptOverride : instruction.value.trim();
    if (!prompt) {
      showError("Введите пожелания для редактирования изображения.");
      return;
    }
    if (controller || selecting) return;
    showError("");
    syncActiveGeometry();
    const baseVersion = history.current();
    const currentOperation = ++operation;
    controller = new AbortController();
    const signal = controller.signal;
    let completed = false,
      failed = false;
    showLoading();
    try {
      const image = await getCurrentBlob();
      if (!image)
        throw new Error("Не удалось подготовить текущее изображение.");
      const body = new FormData();
      body.set("image", image, "image-to-edit.jpg");
      body.set("instruction", prompt);
      const response = await fetch("/api/miniapp/ai/image/edit", {
        method: "POST",
        headers: authHeaders(),
        body,
        signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error?.message ||
            "Не удалось применить изменения. Попробуйте ещё раз.",
        );
      }
      const blob = await response.blob();
      if (!blob.size || !blob.type.startsWith("image/"))
        throw new Error("Сервис не вернул изображение. Попробуйте ещё раз.");
      if (currentOperation !== operation) return;
      const file = new File([blob], `ai-edited-${Date.now()}.png`, {
        type: blob.type,
        lastModified: Date.now(),
      });
      await applyVersion(file, null);
      if (currentOperation !== operation) {
        if (baseVersion)
          await applyVersion(baseVersion.file, baseVersion.geometry).catch(() => {});
        return;
      }
      history.append(file, getGeometry?.() || null);
      render();
      completed = true;
    } catch (error) {
      if (currentOperation === operation && error?.name !== "AbortError")
        failed = true;
    } finally {
      if (currentOperation === operation) {
        controller = null;
        hideLoading();
      }
    }
    if (currentOperation !== operation) return;
    if (failed) {
      showError("");
      if ((await showGenerationResult(false)) === "retry" && currentOperation === operation)
        void run(prompt);
      return;
    }
    if (completed) await showGenerationResult(true);
  }

  generate.onclick = () => void run();
  cancel.onclick = abort;

  function initialize(file) {
    abort();
    history.initialize(file);
    render();
  }

  function destroy() {
    abort();
    selecting = false;
    history.destroy();
    strip.replaceChildren();
    hideLoading();
  }

  return {
    initialize,
    destroy,
    generate: run,
    abort,
    snapshot: history.snapshot,
  };
}
