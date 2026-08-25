import type {ImageMode, PublisherDraft, PublisherImage} from '../publisher/draft';
import {extractTitle, normalizePublicationText} from '../publisher/draft';
import {documentText,plainTextToDocument,type PostDocument} from '../../../shared/post-document';

type GeneratingMode = Extract<ImageMode, 'illustration' | 'infographic'>;
export type WorkflowState =
  | {kind: 'idle'}
  | {kind: 'photo_choice'; source: HTMLElement; originalText: string; postDocument:PostDocument}
  | {kind: 'waiting_for_image'; source: HTMLElement; originalText: string;postDocument:PostDocument; mode: GeneratingMode; boundaryTurn: HTMLElement | null}
  | {kind: 'image_candidate'; source: HTMLElement; originalText: string;postDocument:PostDocument; mode: GeneratingMode; boundaryTurn: HTMLElement | null; turn: HTMLElement; image: PublisherImage}
  | {kind: 'preparing_publisher'; draft: PublisherDraft}
  | {kind: 'publisher_open'; draft: PublisherDraft};

export class PublishWorkflow {
  state: WorkflowState = {kind: 'idle'};

  start(source: HTMLElement, originalText: string,postDocument:PostDocument=plainTextToDocument(originalText)) {
    this.clearOwnedUI();
    this.state = {kind: 'photo_choice', source, originalText: normalizePublicationText(originalText),postDocument:structuredClone(postDocument)};
  }

  waitForImage(mode: GeneratingMode, boundaryTurn: HTMLElement | null) {
    if (this.state.kind !== 'photo_choice' && this.state.kind !== 'image_candidate') return false;
    const {source, originalText,postDocument} = this.state;
    this.clearCandidateUI();
    this.state = {kind: 'waiting_for_image', source, originalText,postDocument, mode, boundaryTurn};
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
    return this.prepare({originalText: this.state.originalText, publicationText: documentText(this.state.postDocument),postDocument:this.state.postDocument, imageMode: 'text_only', image: null});
  }

  selectedImageDraft() {
    if (this.state.kind !== 'image_candidate') return;
    const publicationText = this.state.mode === 'infographic' ? extractTitle(documentText(this.state.postDocument)) : documentText(this.state.postDocument);
    const postDocument=this.state.mode==='infographic'?{schemaVersion:1 as const,blocks:[{type:'heading' as const,content:[{text:publicationText}]}]}:this.state.postDocument;
    return this.prepare({originalText: this.state.originalText, publicationText,postDocument, imageMode: this.state.mode, image: this.state.image});
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
