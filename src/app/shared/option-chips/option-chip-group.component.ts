import { Component, input, output } from '@angular/core';

export interface ChipChoice {
  value: string | number;
  label: string;
  sub?: string;
}

@Component({
  selector: 'app-option-chip-group',
  templateUrl: './option-chip-group.component.html',
  styleUrl: './option-chip-group.component.scss',
})
export class OptionChipGroupComponent {
  readonly label = input('');
  readonly choices = input.required<ChipChoice[]>();
  readonly selected = input<string | number | null>(null);

  readonly selectedChange = output<string | number>();

  choose(value: string | number): void {
    this.selectedChange.emit(value);
  }
}
