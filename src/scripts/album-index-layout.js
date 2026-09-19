// Shared by the initial document and attached, hidden page-turn previews.
// This small classic script is installed in <head> so composition can run
// synchronously as the index is parsed, without a provisional painted spread.
(() => {
  const compose = (root) => {
    if (!root?.matches('[data-album-map-view="index"]')) return;
    const [left, right] = root.querySelectorAll('[data-index-groups]');
    if (!left || !right) return;
    const groups = [...root.querySelectorAll('[data-index-group]')];
    const focus = root.contains(document.activeElement) ? document.activeElement : null;
    left.append(...groups);
    root.dataset.indexLayout = 'spread';
    const restoreFocus = () => {
      if (focus && document.activeElement !== focus) focus.focus({ preventScroll: true });
    };
    if (getComputedStyle(root).getPropertyValue('--index-spread-mode').trim() !== '1') {
      root.dataset.indexLayout = 'flow';
      right.style.removeProperty('margin-block-start');
      restoreFocus();
      return;
    }
    const available = (container) => {
      const page = container.parentElement;
      const box = page.getBoundingClientRect();
      const style = getComputedStyle(page);
      const top = box.top + parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
      const bottom = box.bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth);
      return { capacity: bottom - container.getBoundingClientRect().top, occupied: container.getBoundingClientRect().top - top, height: bottom - top };
    };
    const leftSpace = available(left);
    // Continue at the same editorial list line as the left page, below its heading.
    right.style.marginBlockStart = `${leftSpace.occupied}px`;
    const rightSpace = available(right);
    const heights = groups.map(group => group.getBoundingClientRect().height);
    const gap = parseFloat(getComputedStyle(left).rowGap) || 0;
    const height = (values) => values.reduce((sum, value) => sum + value, 0) + Math.max(0, values.length - 1) * gap;
    let split = -1;
    let best = Infinity;
    const firstSplit = groups.length > 0 ? 1 : 0;
    for (let index = firstSplit; index <= groups.length; index++) {
      const leftHeight = height(heights.slice(0, index));
      const rightHeight = height(heights.slice(index));
      if (leftHeight > leftSpace.capacity || rightHeight > rightSpace.capacity) continue;
      // Balance occupied space, including the title and its actual margins.
      const difference = Math.abs(
        (leftSpace.occupied + leftHeight) / leftSpace.height -
        (rightSpace.occupied + rightHeight) / rightSpace.height,
      );
      if (difference < best) { best = difference; split = index; }
    }
    if (split < 0) {
      // Never crop a group or invent extra routes when a two-page sheet is full.
      // The same natural reading flow is available without JS and on mobile.
      root.dataset.indexLayout = 'flow';
      right.style.removeProperty('margin-block-start');
    } else {
      right.append(...groups.slice(split));
    }
    restoreFocus();
  };
  document.addEventListener('album:compose-index', event => compose(event.detail));
  let pending;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => compose(document.querySelector('[data-album-map-view="index"]')));
  });
})();
