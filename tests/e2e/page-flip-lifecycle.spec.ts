import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('page-flip/package.json'));

for (const format of ['browser', 'module']) {
  test(`page-flip ${format} releases RAFs, handlers and delayed effects across repeated destruction`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Exercise the installed distribution, with real browser RAFs and DOM listeners.
    // A blank document excludes unrelated application RAFs from the accounting.
    await page.goto('about:blank');
    const bundle = await readFile(join(packageRoot, `dist/js/page-flip.${format}.js`), 'utf8');
    const samples = await page.evaluate(async ({ bundle, format }) => {
      const nativeRAF = window.requestAnimationFrame.bind(window);
      const nativeCancel = window.cancelAnimationFrame.bind(window);
      const nativeTimeout = window.setTimeout.bind(window);
      const nativeClear = window.clearTimeout.bind(window);
      const nativeAdd = window.addEventListener.bind(window);
      const nativeRemove = window.removeEventListener.bind(window);
      const rafs = new Map<number, FrameRequestCallback>();
      const timers = new Set<number>();
      const handlers = new Map<string, Set<EventListenerOrEventListenerObject>>();
      window.requestAnimationFrame = callback => {
        const id = nativeRAF(time => { rafs.delete(id); callback(time); });
        rafs.set(id, callback);
        return id;
      };
      window.cancelAnimationFrame = id => { rafs.delete(id); nativeCancel(id); };
      window.setTimeout = ((callback: () => void, delay?: number) => {
        const id = nativeTimeout(() => { timers.delete(id); callback(); }, delay);
        timers.add(id);
        return id;
      }) as typeof window.setTimeout;
      window.clearTimeout = id => { if (typeof id === 'number') timers.delete(id); nativeClear(id); };
      window.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
        if (listener) {
          if (!handlers.has(type)) handlers.set(type, new Set());
          handlers.get(type)!.add(listener);
        }
        if (listener) nativeAdd(type, listener, options);
      };
      window.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
        if (listener) handlers.get(type)?.delete(listener);
        if (listener) nativeRemove(type, listener, options);
      };
      const url = URL.createObjectURL(new Blob([bundle], { type: 'text/javascript' }));
      let PageFlip;
      if (format === 'module') {
        ({ PageFlip } = await import(/* @vite-ignore */ url));
      } else {
        const script = document.createElement('script');
        script.src = url;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.append(script);
        });
        // Public UMD entry, the same distribution selected by the application.
        PageFlip = (window as unknown as { St: { PageFlip: typeof PageFlip } }).St.PageFlip;
      }
      URL.revokeObjectURL(url);
      const tick = () => new Promise<number>(resolve => nativeRAF(resolve));
      const pause = (ms: number) => new Promise<void>(resolve => nativeTimeout(resolve, ms));
      const snapshots = [];
      for (let cycle = 0; cycle < 24; cycle++) {
        const host = document.createElement('div');
        host.style.cssText = 'width:600px;height:400px';
        const pages = Array.from({ length: 4 }, () => document.createElement('div'));
        host.append(...pages);
        document.body.append(host);
        const useMouseEvents = cycle % 2 === 1;
        const flip = new PageFlip(host, { width: 300, height: 400, useMouseEvents, usePortrait: false });
        let events = 0;
        for (const event of ['init', 'flip', 'changeState', 'changeOrientation']) flip.on(event, () => events++);
        flip.loadFromHTML(pages);
        const renderer = flip.getRender();
        const ui = flip.getUI();
        let draws = 0;
        let resizeEffects = 0;
        let touchEffects = 0;
        const draw = renderer.drawFrame.bind(renderer);
        renderer.drawFrame = () => { draws++; draw(); };
        const update = ui.update.bind(ui);
        ui.update = () => { resizeEffects++; update(); };
        const touch = flip.startUserTouch.bind(flip);
        flip.startUserTouch = (point: { x: number; y: number }) => { touchEffects++; touch(point); };
        const mode = cycle % 3;
        let animationStarted = false;
        if (mode !== 0) {
          await tick();
          flip.flipNext();
          animationStarted = renderer.animation !== null;
          await tick();
        }
        // An actual live instance owns exactly one loop and one resize listener.
        const live = { raf: rafs.size, resize: handlers.get('resize')?.size ?? 0 };
        const queuedFrames = [...rafs.values()];
        if (useMouseEvents) {
          ui.getDistElement().dispatchEvent(new TouchEvent('touchstart', {
            changedTouches: [new Touch({ identifier: cycle, target: ui.getDistElement(), clientX: 550, clientY: 300 })],
          }));
        }
        if (mode === 2) {
          // Destruction inside the animation completion callback must not reschedule
          // the currently executing RAF or draw once more after teardown.
          renderer.startAnimation([() => {}], 1, () => flip.destroy());
          await tick();
        } else {
          flip.destroy();
        }
        flip.destroy(); // Idempotence.
        const before = { draws, events, resizeEffects, touchEffects };
        const destroyed = { raf: rafs.size, timers: timers.size };
        // A callback already captured for dispatch must also be harmless.
        for (const callback of queuedFrames) callback(performance.now());
        renderer.start();
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        ui.getDistElement().dispatchEvent(new MouseEvent('mousedown', { clientX: 550, clientY: 300 }));
        ui.getDistElement().dispatchEvent(new TouchEvent('touchstart', {
          changedTouches: [new Touch({ identifier: cycle, target: ui.getDistElement(), clientX: 550, clientY: 300 })],
        }));
        await tick();
        await pause(270); // Beyond the upstream delayed touch threshold.
        snapshots.push({
          cycle, useMouseEvents, mode, animationStarted, live, destroyed,
          after: { raf: rafs.size, timers: timers.size, listeners: [...handlers.values()].reduce((n, set) => n + set.size, 0) },
          effects: { draws: draws - before.draws, events: events - before.events, resize: resizeEffects - before.resizeEffects, touch: touchEffects - before.touchEffects },
          connected: host.isConnected,
        });
      }
      return snapshots;
    }, { bundle, format });
    await testInfo.attach(`page-flip-${format}-lifecycle.json`, { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
    expect(samples).toHaveLength(24);
    for (const sample of samples) {
      expect(sample.live, JSON.stringify(sample)).toEqual({ raf: 1, resize: 1 });
      if (sample.mode !== 0) expect(sample.animationStarted).toBe(true);
      expect(sample.destroyed).toEqual({ raf: 0, timers: 0 });
      expect(sample.after).toEqual({ raf: 0, timers: 0, listeners: 0 });
      expect(sample.effects).toEqual({ draws: 0, events: 0, resize: 0, touch: 0 });
      expect(sample.connected).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}
