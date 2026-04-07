import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism-tomorrow.css';

@Pipe({
  name: 'prismHighlight',
  standalone: true,
})
export class PrismHighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    const highlighted = Prism.highlight(value, Prism.languages['markup'], 'markup');
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
