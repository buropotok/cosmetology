import type {ImageMode, PublisherDraft, PublisherImage} from '../publisher/draft';
import {extractTitle, normalizePublicationText} from '../publisher/draft';

type GeneratingMode = Extract<ImageMode, 'illustration' | 'infographic'>;
export type WorkflowState =
  | {kind: 'idle'}
  | {kind: 'photo_choice'; source: HTMLElement; originalText: string}
  | {kind: 'waiting_for_image'; source: HTMLElement; originalText: string; mode: GeneratingMode; boundaryTurn: HTMLElement | null}
  | {kind: 'image_candidate'; source: HTMLElement; originalText: string; mode: GeneratingMode; boundaryTurn: HTMLElement | null; turn: HTMLElement; image: PublisherImage}
  | {kind: 'preparing_publisher'; draft: PublisherDraft}
  | {kind: 'publisher_open'; draft: PublisherDraft};

export class PublishWorkflow {
  state: WorkflowState = {kind: 'idle'};

  start(source: HTMLElement, originalText: string) {
    this.clearOwnedUI();
    this.state = {kind: 'photo_choice', source, originalText: normalizePublicationText(originalText)};
  }

  waitForImage(mode: GeneratingMode, boundaryTurn: HTMLElement | null) {
    if (this.state.kind !== 'photo_choice' && this.state.kind !== 'image_candidate') return false;
    const {source, originalText} = this.state;
    this.clearCandidateUI();
    this.state = {kind: 'waiting_for_image', source, originalText, mode, boundaryTurn};
    return true;
  }

  setCandidate(turn: HTMLElement, image: PublisherImage) {
    if (this.state.kind !== 'waiting_for_image') return false;
    this.state = {...this.state, kind: 'image_candidate', turn, image};
    return true;
  }

  updateCandidate(turn: HTMLElement, image: PublisherImage) {
    if (this.state.kind !== 'image_candidate' || this.state.turn !== turn) return false;
    this.state = {...this.state, image};
    return true;
  }

  textOnlyDraft() {
    if (this.state.kind !== 'photo_choice') return;
    return this.prepare({originalText: this.state.originalText, publicationText: this.state.originalText, imageMode: 'text_only', image: null});
  }

  selectedImageDraft() {
    if (this.state.kind !== 'image_candidate') return;
    const publicationText = this.state.mode === 'infographic' ? extractTitle(this.state.originalText) : this.state.originalText;
    return this.prepare({originalText: this.state.originalText, publicationText, imageMode: this.state.mode, image: this.state.image});
  }

  opened() {
    if (this.state.kind === 'preparing_publisher') this.state = {kind: 'publisher_open', draft: this.state.draft};
  }

  private prepare(draft: PublisherDraft) {
    this.clearOwnedUI();
    this.state = {kind: 'preparing_publisher', draft};
    return draft;
  }

  private clearCandidateUI() {
    document.querySelectorAll('[data-social-publisher="image-candidate"]').forEach(element => element.remove());
  }

  private clearOwnedUI() {
    document.querySelectorAll('[data-social-publisher="photo-choice"], [data-social-publisher="image-candidate"]').forEach(element => element.remove());
  }
}
