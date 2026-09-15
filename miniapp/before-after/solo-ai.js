import { createSoloImageHistory } from "./solo-image-history.js";

export function createSoloAi({
  root,
  getCurrentBlob,
  applyVersion,
  authHeaders,
  showError,
}) {
  const history = createSoloImageHistory();
  const strip = root.querySelector("#soloVersions"),
    instruction = root.querySelector("#soloAiInstruction");
  const generate = root.querySelector("#soloAiGenerate"),
    undo = root.querySelector("#soloUndo"),
    redo = root.querySelector("#soloRedo");
  const overlay = root.querySelector("#saveOverlay"),
    title = root.querySelector("#saveTitle"),
    stage = root.querySelector("#saveStage"),
    cancel = root.querySelector("#saveCancel");
  let controller = null,
    dotsTimer = 0,
    operation = 0;

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
    undo.disabled = !value.canUndo;
    redo.disabled = !value.canRedo;
  }

  async function select(index) {
    const previous = history.snapshot().activeIndex,
      version = history.select(index);
    if (!version || index === previous) return;
    try {
      await applyVersion(version.file);
      render();
    } catch (error) {
      history.select(previous);
      render();
      showError(error?.message || "Не удалось открыть выбранную версию.");
    }
  }

  function hideLoading() {
    if (dotsTimer) clearInterval(dotsTimer);
    dotsTimer = 0;
    overlay.hidden = true;
    cancel.hidden = true;
    title.textContent = "Загрузка в редактор";
    stage.textContent = "Подготавливаем изображение…";
  }
  function showLoading() {
    let dots = 0;
    title.textContent = "AI-редактирование";
    cancel.hidden = false;
    overlay.hidden = false;
    const tick = () => {
      dots = (dots % 3) + 1;
      stage.textContent = `Применяем изменения${".".repeat(dots)}`;
    };
    tick();
    dotsTimer = window.setInterval(tick, 450);
  }
  function abort() {
    if (!controller) return;
    operation += 1;
    controller.abort();
    controller = null;
    hideLoading();
  }

  async function run() {
    const prompt = instruction.value.trim();
    if (!prompt) {
      showError("Введите пожелания для редактирования изображения.");
      return;
    }
    if (controller) return;
    showError("");
    const currentOperation = ++operation;
    controller = new AbortController();
    const signal = controller.signal;
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
      history.append(file);
      await applyVersion(file);
      render();
    } catch (error) {
      if (currentOperation === operation && error?.name !== "AbortError")
        showError(
          error?.message ||
            "Не удалось применить изменения. Попробуйте ещё раз.",
        );
    } finally {
      if (currentOperation === operation) {
        controller = null;
        hideLoading();
      }
    }
  }

  generate.onclick = () => void run();
  cancel.onclick = abort;
  undo.onclick = () => {
    const value = history.snapshot();
    if (value.canUndo) void select(value.activeIndex - 1);
  };
  redo.onclick = () => {
    const value = history.snapshot();
    if (value.canRedo) void select(value.activeIndex + 1);
  };

  function initialize(file) {
    abort();
    history.initialize(file);
    render();
  }
  function destroy() {
    abort();
    history.destroy();
    strip.replaceChildren();
  }
  return {
    initialize,
    destroy,
    generate: run,
    abort,
    snapshot: history.snapshot,
  };
}
