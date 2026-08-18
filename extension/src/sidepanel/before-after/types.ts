export type BeforeAfterLayout = 'horizontal' | 'vertical';
export type PhotoSlot = 'before' | 'after';

export interface CropTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface EditablePhoto {
  file: File;
  image: HTMLImageElement;
  objectUrl: string;
  transform: CropTransform;
}

export interface BeforeAfterState {
  layout: BeforeAfterLayout;
  before: EditablePhoto | null;
  after: EditablePhoto | null;
}

export const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isAcceptedImage(file: Pick<File, 'type'>) {
  return ACCEPTED_IMAGE_TYPES.has(file.type);
}

export function swapPhotos(state: BeforeAfterState) {
  [state.before, state.after] = [state.after, state.before];
}
