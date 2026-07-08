/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FMP_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}
