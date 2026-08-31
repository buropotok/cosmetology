const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");
const textEl = document.getElementById("post-text");
const imageFrameEl = document.getElementById("image-frame");

async function loadArtifact() {
  try {
    const response = await fetch("/api/test-artifact", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Artifact API returned ${response.status}`);
    }

    const artifact = await response.json();
    textEl.textContent = artifact.text || "";
    imageFrameEl.replaceChildren();

    for (const imageUrl of artifact.images || []) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "Изображение публикации";
      image.loading = "eager";
      imageFrameEl.appendChild(image);
    }

    statusEl.hidden = true;
    contentEl.hidden = false;
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Не удалось загрузить публикацию.";
  }
}

loadArtifact();
