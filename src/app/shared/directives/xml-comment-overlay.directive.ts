import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appXmlCommentOverlay]',
  standalone: true,
})
export class XmlCommentOverlayDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input('appXmlCommentOverlay') source = '';

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private frameId: number | null = null;

  ngAfterViewInit(): void {
    this.scheduleApply();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['source']) {
      this.scheduleApply();
    }
  }

  ngOnDestroy(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
  }

  private scheduleApply(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }

    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      this.applyOverlayTransform();
    });
  }

  private applyOverlayTransform(): void {
    const host = this.elementRef.nativeElement;
    const transformedHtml = host.innerHTML
      .split(/\r?\n/)
      .map((line) => this.transformLine(line))
      .join('\n');

    if (transformedHtml !== host.innerHTML) {
      this.renderer.setProperty(host, 'innerHTML', transformedHtml);
    }
  }

  private transformLine(line: string): string {
    const commentMatch = line.match(
      /^(\s*)<span class="token comment">&lt;!--\s*([\s\S]*?)\s*--&gt;<\/span>\s*$/,
    );
    if (!commentMatch) {
      return line;
    }

    const indentation = commentMatch[1] ?? '';
    const commentText = this.decodeHtml(commentMatch[2] ?? '').trim();
    if (!commentText) {
      return line;
    }

    const indentLevel = this.getIndentLevel(indentation);
    return `<span class="xml-comment-overlay ${this.resolveToneClass(commentText)}" style="--xml-comment-indent:${indentLevel};">${this.escapeHtml(this.getDisplayText(commentText))}</span>`;
  }

  private getIndentLevel(indentation: string): number {
    let level = 0;
    let consecutiveSpaces = 0;

    for (const character of indentation) {
      if (character === '\t') {
        level += 1;
        consecutiveSpaces = 0;
        continue;
      }

      if (character === ' ') {
        consecutiveSpaces += 1;
        if (consecutiveSpaces === 2) {
          level += 1;
          consecutiveSpaces = 0;
        }
      }
    }

    return level;
  }

  private resolveToneClass(commentText: string): string {
    if (commentText.startsWith('Element:')) {
      return 'overlay-element';
    }
    if (commentText.startsWith('Documentation:') || commentText.startsWith('Type documentation:')) {
      return 'overlay-documentation';
    }
    if (commentText.startsWith('Occurs:')) {
      return 'overlay-occurs';
    }
    if (
      commentText.startsWith('Declared type:') ||
      commentText.startsWith('Resolved schema type:') ||
      commentText.startsWith('Resolved built-in XSD type:') ||
      commentText.startsWith('Type:')
    ) {
      return 'overlay-type';
    }
    if (
      commentText.startsWith('Required attributes:') ||
      commentText.startsWith('Optional attributes available:') ||
      commentText.startsWith('Attribute ')
    ) {
      return 'overlay-attributes';
    }
    if (commentText.startsWith('Allowed values:') || commentText.startsWith('Restrictions:')) {
      return 'overlay-restrictions';
    }

    return 'overlay-default';
  }

  private getDisplayText(commentText: string): string {
    const separatorIndex = commentText.indexOf(':');
    if (separatorIndex === -1) {
      return commentText;
    }

    return commentText.slice(separatorIndex + 1).trim();
  }

  private decodeHtml(value: string): string {
    return value
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&amp;', '&');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
