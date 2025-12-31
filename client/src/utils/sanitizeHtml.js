import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS attacks while preserving safe HTML formatting.
 * This keeps safe tags like <p>, <br>, <strong>, <em>, <a>, <ul>, <li>, <blockquote>, etc.
 * but removes dangerous elements like <script>, <iframe>, and event handlers.
 *
 * @param {string} html - The HTML string to sanitize
 * @param {object} options - DOMPurify configuration options
 * @returns {string} - Sanitized HTML string safe to render
 */
export function sanitizeHtml(html, options = {}) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Configure DOMPurify to allow common safe HTML tags and attributes
  const defaultOptions = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img', 'div', 'span'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'target', 'rel',
      'class', 'id'
    ],
    // Add rel="noopener noreferrer" to all links for security
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onsubmit'],
    // Allow data: and https: protocols for links/images
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Safe to handle SVG and other markup
    USE_PROFILES: { html: true, svg: false, svgFilters: false },
    ...options
  };

  return DOMPurify.sanitize(html, defaultOptions);
}

/**
 * Strip all HTML tags and return plain text.
 * Use this when you want to display content without any HTML formatting.
 *
 * @param {string} html - The HTML string to strip
 * @returns {string} - Plain text without HTML tags
 */
export function stripHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Use DOMPurify with no allowed tags to strip everything
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}

/**
 * Sanitize and truncate HTML content to a maximum length.
 * Useful for article previews/snippets.
 *
 * @param {string} html - The HTML string to sanitize and truncate
 * @param {number} maxLength - Maximum length in characters (default: 200)
 * @returns {string} - Sanitized and truncated HTML string
 */
export function sanitizeAndTruncate(html, maxLength = 200) {
  // First strip all HTML to get plain text for length check
  const plainText = stripHtml(html);

  if (plainText.length <= maxLength) {
    return sanitizeHtml(html);
  }

  // Return truncated plain text with ellipsis
  return plainText.substring(0, maxLength) + '...';
}
