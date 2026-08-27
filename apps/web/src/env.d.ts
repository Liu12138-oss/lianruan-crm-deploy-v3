/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

// admin.html 通过 <script src="libs/xlsx.full.min.js"> 提供全局 XLSX（SheetJS 0.18.5）
declare const XLSX: {
  read(
    data: Uint8Array,
    options: { type: string },
  ): {
    Sheets: Record<string, unknown>;
    SheetNames: string[];
  };
  utils: {
    sheet_to_json(sheet: unknown, options?: { defval?: unknown }): Record<string, unknown>[];
    aoa_to_sheet(rows: (string | number)[][]): unknown;
    book_new(): unknown;
    book_append_sheet(book: unknown, sheet: unknown, name: string): void;
  };
  writeFile(book: unknown, fileName: string): void;
};
