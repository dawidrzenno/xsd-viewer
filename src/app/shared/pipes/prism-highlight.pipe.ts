import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';

@Pipe({
  name: 'prismHighlight',
  standalone: true,
})
export class PrismHighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string, language: 'markup' | 'json' = 'markup'): SafeHtml {
    const grammar = Prism.languages[language] ?? Prism.languages['markup'];
    const highlighted = Prism.highlight(value, grammar, language);
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
