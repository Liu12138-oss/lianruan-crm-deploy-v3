// fontkit 2.0.4 未随包发布类型声明，这里按本仓库实际用到的能力补充最小声明。
declare module "fontkit" {
  export interface 字体字形 {
    id: number;
    advanceWidth: number;
    codePoints: number[];
  }

  export interface 字体子集 {
    includeGlyph(字形: 字体字形 | number): number;
    encode(): Uint8Array;
  }

  export interface 字体对象 {
    postscriptName: string;
    unitsPerEm: number;
    numGlyphs: number;
    ascent: number;
    descent: number;
    capHeight?: number;
    italicAngle?: number;
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    glyphForCodePoint(码点: number): 字体字形;
    getGlyph(编号: number): 字体字形;
    createSubset(): 字体子集;
  }

  export function openSync(文件名: string, postscriptName?: string): 字体对象;
  export function open(缓冲区: Buffer, postscriptName?: string): 字体对象;
}
