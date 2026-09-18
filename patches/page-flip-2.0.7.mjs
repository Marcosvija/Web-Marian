// Install-time patch for BOTH published bundles of page-flip@2.0.7.
// The upstream TypeScript method names below make each replacement traceable.
// Exact hashes and occurrence counts deliberately reject any upstream drift.
export const version = '2.0.7';
export const bundles = {
  'page-flip.browser.js': {
    upstream: 'bbaca0bbef57a22bb66a3fc69d67baf9a17fb9a9c89ec9ed35e2b91abe4bd1e7',
    patched: 'c23030012715bfcc7520a5cb1a7c4da1d88272f63d5cced60cfe0acc0e5c16fe',
  },
  'page-flip.module.js': {
    upstream: 'b718faafca6856bff51629baedeff601e2cc59482e951105bdbd6e46978cca38',
    patched: 'a822f5513038ccfb43b52e387f305401601ab0ca3cdf037eba94cf467ab1c86a',
  },
};

export const replacements = [
  // Render.start / new Render.destroy: own the RAF and discard animation callbacks.
  ['start(){this.update();const t=e=>{this.render(e),requestAnimationFrame(t)};requestAnimationFrame(t)}', `start() {
    if (this.destroyed || this.running) return;
    this.running = true;
    this.update();
    const loop = (timer) => {
      this.frameRequest = null;
      if (this.destroyed) return;
      this.render(timer);
      if (!this.destroyed) this.frameRequest = requestAnimationFrame(loop);
    };
    if (!this.destroyed) this.frameRequest = requestAnimationFrame(loop);
  }
  destroy() {
    this.destroyed = true;
    if (this.frameRequest != null) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = null;
    this.animation = null;
    this.leftPage = this.rightPage = this.flippingPage = this.bottomPage = null;
    this.shadow = null;
  }`],
  // Render.render: destruction from an animation callback must also stop this frame.
  ['render(t){if(null!==this.animation)', 'render(t){if(this.destroyed)return;if(null!==this.animation)'],
  ['this.timer=t,this.drawFrame()', 'if(!this.destroyed){this.timer=t;this.drawFrame()}'],
  ['startAnimation(t,e,i){this.finishAnimation(),this.animation=',
    'startAnimation(t,e,i){if(this.destroyed)return;this.finishAnimation();if(this.destroyed)return;this.animation='],
  ['finishAnimation(){null!==this.animation&&(this.animation.frames[this.animation.frames.length-1](),null!==this.animation.onAnimateEnd&&this.animation.onAnimateEnd()),this.animation=null}', `finishAnimation() {
    if (this.destroyed) return;
    const animation = this.animation;
    if (animation !== null) {
      animation.frames[animation.frames.length - 1]();
      if (!this.destroyed && animation.onAnimateEnd !== null) animation.onAnimateEnd();
    }
    this.animation = null;
  }`],
  // UI.destroy: resize is registered even with useMouseEvents:false.
  ['destroy(){this.app.getSettings().useMouseEvents&&this.removeHandlers(),this.distElement.remove(),this.wrapper.remove()}', `destroy() {
    this.destroyed = true;
    clearTimeout(this.touchTimeout);
    this.touchPoint = null;
    this.removeHandlers();
    this.distElement.remove();
    this.wrapper.remove();
  }`],
  ['this.onResize=()=>{this.update()}', 'this.onResize=()=>{if(!this.destroyed)this.update()}'],
  // UI.onTouchStart: cancel the delayed touch action, including repeated touches.
  ['setTimeout(()=>{null!==this.touchPoint&&this.app.startUserTouch(i)},this.swipeTimeout)',
    'clearTimeout(this.touchTimeout),this.touchTimeout=setTimeout(()=>{!this.destroyed&&null!==this.touchPoint&&this.app.startUserTouch(i)},this.swipeTimeout)'],
  // PageFlip.destroy: idempotent and safe before/after loading or partial setup.
  ['destroy(){this.ui.destroy(),this.block.remove()}', `destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.initTimeout);
    this.events.clear();
    this.render?.destroy();
    this.ui?.destroy();
    this.block.remove();
  }`],
  ['loadFromImages(t){', 'loadFromImages(t){if(this.destroyed)return;'],
  ['loadFromHTML(t){', 'loadFromHTML(t){if(this.destroyed)return;'],
  // PageFlip.loadFromHTML / loadFromImages: cancel the deferred Safari init.
  ['setTimeout(()=>{this.ui.update(),this.trigger("init",this,{page:this.setting.startPage,mode:this.render.getOrientation()})},1)', `this.initTimeout=setTimeout(()=>{
    if (this.destroyed) return;
    this.ui.update();
    this.trigger("init",this,{page:this.setting.startPage,mode:this.render.getOrientation()});
  },1)`, 2],
  // EventObject: no events after destroy, even when a listener destroys its owner.
  ['on(t,e){return this.events.has(t)', 'on(t,e){if(this.destroyed)return this;return this.events.has(t)'],
  ['trigger(t,e,i=null){if(this.events.has(t))for(const s of this.events.get(t))s({data:i,object:e})}', `trigger(t,e,i=null) {
    if (this.destroyed || !this.events.has(t)) return;
    for (const callback of this.events.get(t)) {
      if (this.destroyed) break;
      callback({data:i,object:e});
    }
  }`],
];

export function patchBundle(source) {
  for (const [before, after, count = 1] of replacements) {
    if (source.split(before).length - 1 !== count) {
      throw new Error(`page-flip@${version}: patch context mismatch: ${before}`);
    }
    source = source.replaceAll(before, after);
  }
  return source;
}
