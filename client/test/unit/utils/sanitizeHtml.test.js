import { describe, it, expect } from 'vitest';
import { sanitizeHtml, stripHtml, sanitizeAndTruncate } from '../../../src/utils/sanitizeHtml';

describe('sanitizeHtml', () => {
  describe('XSS Protection', () => {
    it('should remove script tags', () => {
      const input = '<p>Safe content</p><script>alert("XSS")</script>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Safe content');
    });

    it('should remove iframe tags', () => {
      const input = '<p>Content</p><iframe src="evil.com"></iframe>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('evil.com');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="malicious()">Click me</div>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('malicious');
    });

    it('should remove onerror event handlers', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('javascript:');
    });

    it('should handle data: protocol in images', () => {
      const input = '<img src="data:image/svg+xml,<script>alert(1)</script>">';
      const result = sanitizeHtml(input);
      // Data URLs for images should be allowed if content-type is image
      // but the script tag inside should be neutralized by not executing
      expect(result).toContain('src=');
    });

    it('should remove object tags', () => {
      const input = '<object data="evil.swf"></object>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<object');
    });

    it('should remove embed tags', () => {
      const input = '<embed src="evil.swf">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<embed');
    });

    it('should remove form tags', () => {
      const input = '<form action="steal.com"><input type="text"></form>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<form');
      expect(result).not.toContain('<input');
    });

    it('should remove button tags', () => {
      const input = '<button onclick="evil()">Click</button>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<button');
    });
  });

  describe('Allowed Tags and Attributes', () => {
    it('should preserve paragraph tags', () => {
      const input = '<p>This is a paragraph</p>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<p>');
      expect(result).toContain('</p>');
    });

    it('should preserve line breaks', () => {
      const input = 'Line 1<br>Line 2<br/>Line 3';
      const result = sanitizeHtml(input);
      expect(result).toContain('<br>');
    });

    it('should preserve bold and italic tags', () => {
      const input = '<strong>Bold</strong> and <em>italic</em> and <b>bold</b> and <i>italic</i>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
      expect(result).toContain('<b>');
      expect(result).toContain('<i>');
    });

    it('should preserve links with href', () => {
      const input = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<a');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('>Link<');
    });

    it('should allow target attribute in links when present', () => {
      const input = '<a href="https://example.com" target="_blank">Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toContain('target=');
    });

    it('should preserve lists', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    it('should preserve blockquotes', () => {
      const input = '<blockquote>Quoted text</blockquote>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<blockquote>');
      expect(result).toContain('Quoted text');
    });

    it('should preserve code blocks', () => {
      const input = '<pre><code>const x = 1;</code></pre>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<pre>');
      expect(result).toContain('<code>');
      expect(result).toContain('const x = 1;');
    });

    it('should preserve headings', () => {
      const input = '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<h1>');
      expect(result).toContain('<h2>');
      expect(result).toContain('<h3>');
    });

    it('should preserve images with src and alt', () => {
      const input = '<img src="https://example.com/image.jpg" alt="Description">';
      const result = sanitizeHtml(input);
      expect(result).toContain('<img');
      expect(result).toContain('src="https://example.com/image.jpg"');
      expect(result).toContain('alt="Description"');
    });

    it('should preserve class and id attributes', () => {
      const input = '<div class="my-class" id="my-id">Content</div>';
      const result = sanitizeHtml(input);
      expect(result).toContain('class="my-class"');
      expect(result).toContain('id="my-id"');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = sanitizeHtml(null);
      expect(result).toBe('');
    });

    it('should handle undefined input', () => {
      const result = sanitizeHtml(undefined);
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizeHtml(123);
      expect(result).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const input = 'Just plain text';
      const result = sanitizeHtml(input);
      expect(result).toBe('Just plain text');
    });

    it('should handle malformed HTML', () => {
      const input = '<p>Unclosed paragraph<div>Nested</p>';
      const result = sanitizeHtml(input);
      expect(result).toBeTruthy();
    });

    it('should handle nested tags', () => {
      const input = '<div><p><strong>Nested</strong> content</p></div>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<strong>');
      expect(result).toContain('Nested');
    });

    it('should handle HTML comments', () => {
      const input = '<p>Content</p><!-- Comment --><p>More content</p>';
      const result = sanitizeHtml(input);
      expect(result).toContain('Content');
      expect(result).toContain('More content');
    });

    it('should handle special characters', () => {
      const input = '<p>Special: &lt; &gt; &amp; "quotes"</p>';
      const result = sanitizeHtml(input);
      expect(result).toContain('Special:');
    });
  });

  describe('Custom Options', () => {
    it('should accept custom options that override defaults', () => {
      const input = '<p>Content</p><span>Extra</span>';
      const result = sanitizeHtml(input, { ALLOWED_TAGS: ['p', 'span'] });
      expect(result).toContain('<p>');
      expect(result).toContain('<span>');
    });

    it('should merge options with defaults', () => {
      const input = '<p>Paragraph</p><div>Division</div>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<p>');
      expect(result).toContain('<div>');
    });
  });
});

describe('stripHtml', () => {
  it('should remove all HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    const result = stripHtml(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('Hello world');
  });

  it('should preserve text content', () => {
    const input = '<div>Text content</div>';
    const result = stripHtml(input);
    expect(result).toBe('Text content');
  });

  it('should handle multiple lines', () => {
    const input = '<p>Line 1</p>\n<p>Line 2</p>';
    const result = stripHtml(input);
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
  });

  it('should handle empty string', () => {
    const result = stripHtml('');
    expect(result).toBe('');
  });

  it('should handle null', () => {
    const result = stripHtml(null);
    expect(result).toBe('');
  });

  it('should handle undefined', () => {
    const result = stripHtml(undefined);
    expect(result).toBe('');
  });

  it('should strip script tags completely', () => {
    const input = '<p>Before</p><script>alert("XSS")</script><p>After</p>';
    const result = stripHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('should strip style tags', () => {
    const input = '<style>body { color: red; }</style><p>Content</p>';
    const result = stripHtml(input);
    expect(result).not.toContain('<style>');
    expect(result).toContain('Content');
  });

  it('should handle HTML entities', () => {
    const input = '<p>&lt;tag&gt; &amp; &quot;quotes&quot;</p>';
    const result = stripHtml(input);
    expect(result).toBeTruthy();
  });
});

describe('sanitizeAndTruncate', () => {
  it('should sanitize HTML', () => {
    const input = '<p>Safe <script>alert("XSS")</script> content</p>';
    const result = sanitizeAndTruncate(input, 200);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Safe');
    expect(result).toContain('content');
  });

  it('should not truncate short content', () => {
    const input = '<p>Short content</p>';
    const result = sanitizeAndTruncate(input, 200);
    expect(result).toContain('<p>');
    expect(result).toContain('Short content');
    expect(result).not.toContain('...');
  });

  it('should truncate long content and add ellipsis', () => {
    const longText = 'a'.repeat(300);
    const input = `<p>${longText}</p>`;
    const result = sanitizeAndTruncate(input, 100);
    expect(result.length).toBeLessThan(110); // 100 + '...'
    expect(result).toContain('...');
  });

  it('should use default maxLength of 200', () => {
    const input = '<p>' + 'a'.repeat(300) + '</p>';
    const result = sanitizeAndTruncate(input);
    expect(result.length).toBeLessThan(210); // 200 + '...'
    expect(result).toContain('...');
  });

  it('should return plain text when truncated', () => {
    const input = '<p>' + 'a'.repeat(300) + '</p>';
    const result = sanitizeAndTruncate(input, 100);
    expect(result).not.toContain('<p>');
    expect(result).toContain('...');
  });

  it('should preserve HTML when under limit', () => {
    const input = '<p><strong>Bold text</strong></p>';
    const result = sanitizeAndTruncate(input, 200);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('Bold text');
  });

  it('should handle empty string', () => {
    const result = sanitizeAndTruncate('');
    expect(result).toBe('');
  });

  it('should handle null', () => {
    const result = sanitizeAndTruncate(null);
    expect(result).toBe('');
  });

  it('should handle undefined', () => {
    const result = sanitizeAndTruncate(undefined);
    expect(result).toBe('');
  });

  it('should count plain text length not HTML', () => {
    const input = '<p>' + 'a'.repeat(100) + '</p>';
    const result = sanitizeAndTruncate(input, 150);
    expect(result).toContain('<p>');
    expect(result).not.toContain('...');
  });

  it('should handle mixed HTML and text', () => {
    const input = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
    const result = sanitizeAndTruncate(input, 200);
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });
});
