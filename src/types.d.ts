declare module "page-flip" {
  export class PageFlip {
    constructor(container: HTMLElement, options: any);
    loadFromHTML(pages: HTMLElement[]): void;
    turnToPage(page: number): void;
    flipNext(corner?: string): void;
    flipPrev(corner?: string): void;
    getCurrentPageIndex(): number;
    on(event: string, callback: (e: any) => void): void;
    destroy(): void;
  }
}
