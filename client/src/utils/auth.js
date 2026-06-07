const AUTH_KEY = 'rss_basic_auth';

/**
 * Check if credentials are stored in localStorage
 */
export function hasAuth() {
  return !!localStorage.getItem(AUTH_KEY);
}

/**
 * Get the Authorization header value for Basic Auth.
 * Returns undefined if no credentials are stored.
 */
export function getAuthHeader() {
  const encoded = localStorage.getItem(AUTH_KEY);
  if (!encoded) return undefined;
  return `Basic ${encoded}`;
}

/**
 * Store base64-encoded credentials in localStorage.
 */
export function saveAuth(username, password) {
  const encoded = btoa(`${username}:${password}`);
  localStorage.setItem(AUTH_KEY, encoded);
}

/**
 * Remove stored credentials.
 */
export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}
