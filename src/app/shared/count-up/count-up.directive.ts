import { Directive, ElementRef, Input, OnChanges, inject } from '@angular/core';
import { MotionService } from '../../core/services/motion.service';

/**
 * Animates a host element's text from its previous numeric value to a new one.
 * First bind (mount) counts up from 0; later changes count from the prior value,
 * so only the actual delta animates rather than replaying from zero every time.
 */
@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective implements OnChanges {
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly motion = inject(MotionService);

  @Input('appCountUp') value = 0;
  @Input() countUpSuffix = '';
  @Input() countUpDuration = 700;

  private raf = 0;
  private from = 0;
  private started = false;

  ngOnChanges(): void {
    const target = Number(this.value) || 0;

    if (this.motion.reducedMotion()) {
      this.el.textContent = `${target}${this.countUpSuffix}`;
      this.from = target;
      this.started = true;
      return;
    }

    const start = this.started ? this.from : 0;
    this.started = true;
    const startTime = performance.now();
    const duration = this.countUpDuration;
    cancelAnimationFrame(this.raf);

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (target - start) * eased);
      this.el.textContent = `${current}${this.countUpSuffix}`;
      if (t < 1) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.from = target;
      }
    };
    this.raf = requestAnimationFrame(tick);
  }
}
