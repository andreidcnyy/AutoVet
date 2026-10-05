import { useEffect } from "react";

/**
 * Freezes the page behind an open modal.
 *
 * Without this the wheel keeps reaching the page underneath, so scrolling
 * inside a dialog quietly scrolled the settings page behind it — you closed the
 * modal and found yourself somewhere else entirely, typically down at Units of
 * Measure.
 *
 * The scrollbar's width is added back as padding, because hiding the page's
 * scrollbar otherwise widens the content by that much and the whole layout
 * jumps sideways as the modal opens.
 *
 * Nested or stacked modals are counted, so the inner one closing does not
 * unfreeze the page while the outer one is still open.
 *
 *   useLockBodyScroll(isOpen);
 */
let lockCount = 0;
let restore = null;

export function useLockBodyScroll(active = true) {
  useEffect(() => {
    if (!active) return undefined;

    if (lockCount === 0) {
      const { body } = document;
      const gap = window.innerWidth - document.documentElement.clientWidth;

      restore = {
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
      };

      body.style.overflow = "hidden";
      if (gap > 0) {
        const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${current + gap}px`;
      }
    }

    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0 && restore) {
        document.body.style.overflow = restore.overflow;
        document.body.style.paddingRight = restore.paddingRight;
        restore = null;
      }
    };
  }, [active]);
}

export default useLockBodyScroll;
