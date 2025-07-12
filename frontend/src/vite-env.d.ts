/// &lt;reference types="vite/client" /&gt;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // add more env variables here...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
