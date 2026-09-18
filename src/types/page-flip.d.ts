declare module 'page-flip' {
  export type FlipCorner = 'top' | 'bottom';

  export interface PageFlipEvent<T = unknown> {
    data: T;
    object: PageFlip;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, string | number | boolean>);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    startUserTouch(pos: { x: number; y: number }): void;
    userMove(pos: { x: number; y: number }, isTouch: boolean): void;
    userStop(pos: { x: number; y: number }, isSwipe?: boolean): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    turnToPage(pageNum: number): void;
    getCurrentPageIndex(): number;
    getState(): string;
    getUI(): { getDistElement(): HTMLElement };
    on(eventName: string, callback: (event: PageFlipEvent<any>) => void): PageFlip;
  }
}
