export type Platform = "vk" | "telegram";
export type PublicationStatus = "pending" | "published" | "failed";
export interface Metadata { title?: string; topic?: string; summary?: string; content_type?: string }
export interface PublishRequest { text: string; targets: Platform[]; metadata?: Metadata; post_id?: number; idempotency_key: string }
export interface PublicationResult { status: PublicationStatus; external_id?: string; url?: string; error?: string; image_status?: "manual_required" }
export interface PublishResponse { post_id: number; publications: Partial<Record<Platform, PublicationResult>> }
export interface PostSummary { id:number; title:string|null; topic:string|null; summary:string|null; content_type:string|null; text:string; image_url:string|null; created_at:string; published_at:string|null; publications:Partial<Record<Platform,PublicationResult>> }
export interface PostsResponse { items:PostSummary[]; page:number; page_size:number; total:number }
