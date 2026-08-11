import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle-row',
  templateUrl: './toggle-row.component.html',
  styleUrl: './toggle-row.component.scss',
})
export class ToggleRowComponent {
  readonly label = input.required<string>();
  readonly sub = input<string>('');
  readonly checked = input(false);

  readonly checkedChange = output<boolean>();

  onChange(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
