import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface WordsData {
  ANSWERS: Record<string, string[]>;
  GUESSES: Record<string, string[]>;
  CATEGORIES: Record<string, string[]>;
}

/** Loads the word-list JSON asset once and serves answer/guess/category pools from memory. */
@Injectable({ providedIn: 'root' })
export class WordsService {
  private readonly http = inject(HttpClient);
  private data: WordsData | null = null;
  private loadPromise: Promise<WordsData> | null = null;

  readonly ready = signal(false);

  load(): Promise<WordsData> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = firstValueFrom(this.http.get<WordsData>('data/words.json')).then((data) => {
      this.data = data;
      this.ready.set(true);
      return data;
    });
    return this.loadPromise;
  }

  private ensure(): WordsData {
    if (!this.data) {
      throw new Error('WordsService used before words.json finished loading');
    }
    return this.data;
  }

  answerPool(length: number): string[] {
    return this.ensure().ANSWERS[String(length)] || [];
  }

  guessPool(length: number): string[] {
    return this.ensure().GUESSES[String(length)] || [];
  }

  categoryWords(category: string, length = 5): string[] {
    const words = this.ensure().CATEGORIES[category] || [];
    return length ? words.filter((w) => w.length === length) : words;
  }

  categories(): string[] {
    return Object.keys(this.ensure().CATEGORIES);
  }

  availableLengths(): number[] {
    return Object.keys(this.ensure().ANSWERS)
      .map(Number)
      .sort((a, b) => a - b);
  }
}
