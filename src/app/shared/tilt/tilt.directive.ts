import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';
import { MotionService } from '../../core/services/motion.service';

/**
 * Pointer-reactive tilt: sets --tilt-rx/--tilt-ry/--tilt-px/--tilt-py custom properties
 * on the host element, which the element's own CSS turns into a perspective transform
 * and/or a light-position gradient. Mouse-only (touch devices have no hover concept to
 * tilt toward) and inert under reduced-motion.
 */
@Directive({
  selector: '[appTilt]',
  host: { class: 'tilt-host' },
})
export class TiltDirective {
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly motion = inject(MotionService);

  @Input('appTilt') maxDeg = 8;

  private raf = 0;

  @HostListener('pointermove', ['$event'])
  onPointerMove(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.motion.reducedMotion()) return;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const rect = this.el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const max = this.maxDeg;
      const ry = (px - 0.5) * max * 2;
      const rx = (0.5 - py) * max * 2;
      this.el.style.setProperty('--tilt-rx', `${rx.toFixed(2)}deg`);
      this.el.style.setProperty('--tilt-ry', `${ry.toFixed(2)}deg`);
      this.el.style.setProperty('--tilt-px', `${(px * 100).toFixed(1)}%`);
      this.el.style.setProperty('--tilt-py', `${(py * 100).toFixed(1)}%`);
    });
  }

  @HostListener('pointerleave')
  onPointerLeave(): void {
    this.el.style.setProperty('--tilt-rx', '0deg');
    this.el.style.setProperty('--tilt-ry', '0deg');
    this.el.style.setProperty('--tilt-px', '50%');
    this.el.style.setProperty('--tilt-py', '50%');
  }
}
