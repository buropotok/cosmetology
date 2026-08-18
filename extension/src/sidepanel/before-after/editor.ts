import {canvasToPng, renderBeforeAfter} from './compositor';
import {panTransform} from './geometry';
import {buildBeforeAfterFilename} from './export';
import {isAcceptedImage, swapPhotos, type BeforeAfterLayout, type BeforeAfterState, type PhotoSlot} from './types';

interface EditorOptions {
  onCancel: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

export class BeforeAfterEditor {
  readonly state: BeforeAfterState = {layout: 'horizontal', before: null, after: null};
  private readonly section: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly error: HTMLElement;

  constructor(private readonly options: EditorOptions) {
    this.section = document.getElementById('beforeAfter')!;
    this.canvas = document.getElementById('beforeAfterCanvas') as HTMLCanvasElement;
    this.saveButton = document.getElementById('beforeAfterSave') as HTMLButtonElement;
    this.error = document.getElementById('beforeAfterError')!;
    this.bindSlot('before');
    this.bindSlot('after');
    this.bindZoom('before');
    this.bindZoom('after');
    document.querySelectorAll<HTMLButtonElement>('[data-ba-layout]').forEach(button => button.addEventListener('click', () => this.setLayout(button.dataset.baLayout as BeforeAfterLayout)));
    document.getElementById('beforeAfterSwap')!.addEventListener('click', () => this.swap());
    document.getElementById('beforeAfterCancel')!.addEventListener('click', () => this.cancel());
    this.saveButton.addEventListener('click', () => void this.save());
    this.render();
  }

  open() {
    this.cleanup();
    this.setLayout('horizontal');
    this.section.hidden = false;
    this.error.textContent = '';
    this.render();
  }

  close() {
    this.section.hidden = true;
  }

  discard() {
    this.cleanup();
    this.close();
  }

  private photo(slot: PhotoSlot) { return this.state[slot]; }

  setLayout(layout: BeforeAfterLayout) {
    this.state.layout = layout;
    document.querySelectorAll<HTMLButtonElement>('[data-ba-layout]').forEach(button => button.classList.toggle('selected', button.dataset.baLayout === layout));
    this.render();
  }

  private bindSlot(slot: PhotoSlot) {
    const viewport = document.querySelector<HTMLElement>(`[data-ba-slot="${slot}"]`)!;
    const input = document.getElementById(`${slot}File`) as HTMLInputElement;
    input.addEventListener('change', () => { const file = input.files?.[0]; if (file) void this.load(slot, file); input.value = ''; });
    viewport.addEventListener('click', event => { if (!this.photo(slot) && !(event.target as HTMLElement).closest('button')) input.click(); });
    viewport.querySelector<HTMLButtonElement>('[data-ba-replace]')!.addEventListener('click', event => { event.stopPropagation(); input.click(); });
    viewport.addEventListener('dragover', event => { event.preventDefault(); viewport.classList.add('drag-over'); });
    viewport.addEventListener('dragleave', () => viewport.classList.remove('drag-over'));
    viewport.addEventListener('drop', event => {
      event.preventDefault();
      viewport.classList.remove('drag-over');
      const file = event.dataTransfer?.files[0];
      if (file) void this.load(slot, file);
    });
    viewport.addEventListener('pointerdown', event => {
      const photo = this.photo(slot);
      if (!photo || (event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('panning');
      let lastX = event.clientX;
      let lastY = event.clientY;
      const move = (next: PointerEvent) => {
        const rect = viewport.getBoundingClientRect();
        photo.transform = panTransform(photo.transform, next.clientX - lastX, next.clientY - lastY,
          {width: photo.image.naturalWidth, height: photo.image.naturalHeight}, {width: rect.width, height: rect.height});
        lastX = next.clientX;
        lastY = next.clientY;
        this.render();
      };
      const end = () => {
        viewport.classList.remove('panning');
        viewport.removeEventListener('pointermove', move);
        viewport.removeEventListener('pointerup', end);
        viewport.removeEventListener('pointercancel', end);
      };
      viewport.addEventListener('pointermove', move);
      viewport.addEventListener('pointerup', end);
      viewport.addEventListener('pointercancel', end);
    });
  }

  private bindZoom(slot: PhotoSlot) {
    const slider = document.getElementById(`${slot}Zoom`) as HTMLInputElement;
    slider.addEventListener('input', () => {
      const photo = this.photo(slot);
      if (!photo) return;
      photo.transform = {...photo.transform, zoom: Number(slider.value)};
      this.render();
    });
  }

  async load(slot: PhotoSlot, file: File) {
    if (!isAcceptedImage(file)) {
      this.error.textContent = 'Поддерживаются только JPEG, PNG и WebP.';
      return false;
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const value = new Image();
        value.onload = () => resolve(value);
        value.onerror = () => reject(new Error('Не удалось открыть изображение'));
        value.src = objectUrl;
      });
      const previous = this.photo(slot);
      if (previous) URL.revokeObjectURL(previous.objectUrl);
      this.state[slot] = {file, image, objectUrl, transform: {zoom: 1, offsetX: 0, offsetY: 0}};
      this.error.textContent = '';
      (document.getElementById(`${slot}Zoom`) as HTMLInputElement).value = '1';
      this.render();
      return true;
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      this.error.textContent = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  swap() {
    swapPhotos(this.state);
    (document.getElementById('beforeZoom') as HTMLInputElement).value = String(this.state.before?.transform.zoom ?? 1);
    (document.getElementById('afterZoom') as HTMLInputElement).value = String(this.state.after?.transform.zoom ?? 1);
    this.render();
  }

  private render() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    renderBeforeAfter(ctx, this.state);
    document.querySelector<HTMLElement>('.ba-preview')!.dataset.layout = this.state.layout;
    for (const slot of ['before', 'after'] as const) {
      const viewport = document.querySelector<HTMLElement>(`[data-ba-slot="${slot}"]`)!;
      viewport.classList.toggle('has-photo', Boolean(this.photo(slot)));
      (document.getElementById(`${slot}Zoom`) as HTMLInputElement).disabled = !this.photo(slot);
    }
    this.saveButton.disabled = !(this.state.before && this.state.after);
  }

  private async save() {
    if (!this.state.before || !this.state.after) return;
    this.render();
    this.saveButton.disabled = true;
    try {
      const blob = await canvasToPng(this.canvas);
      await this.options.onSave(blob, buildBeforeAfterFilename());
      this.cleanup();
      this.close();
    } catch (error) {
      this.error.textContent = error instanceof Error ? error.message : String(error);
      this.saveButton.disabled = false;
    }
  }

  private cancel() {
    this.cleanup();
    this.close();
    this.options.onCancel();
  }

  cleanup() {
    for (const slot of ['before', 'after'] as const) {
      const photo = this.photo(slot);
      if (photo) URL.revokeObjectURL(photo.objectUrl);
      this.state[slot] = null;
      (document.getElementById(`${slot}Zoom`) as HTMLInputElement).value = '1';
    }
  }
}
