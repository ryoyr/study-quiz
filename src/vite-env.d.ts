/// <reference types="vite/client" />

export {};

declare global {
  interface ImportMetaEnv {
    /** Cloudflare D1 content Workerの公開URL。秘密値は設定しない。 */
    readonly VITE_QUIZ_CONTENT_API_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
