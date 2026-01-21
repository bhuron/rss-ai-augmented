/**
 * Normalize a URL by removing tracking parameters and hashes
 * Preserves YouTube video IDs
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);

    // For YouTube, preserve the 'v' parameter (video ID) - it's essential!
    const isYouTube = u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be');

    // Remove common tracking parameters from various platforms
    const paramsToRemove = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'ref', 'source', 'mc_cid', 'mc_eid', // Mailchimp
      '_hsenc', '_hsmi', // HubSpot
      'fbclid', 'gclid', // Facebook/Google
      'r', 's', 'publication_id', 'post_id', // Substack
      't', // Ghost (but NOT 'v' for YouTube!)
      'share', 'doing_wp_cron', // WordPress
      'feature', // YouTube tracking
    ];

    // For YouTube, keep the 'v' parameter
    paramsToRemove.forEach(param => {
      if (isYouTube && param === 'v') return; // Don't remove video ID!
      u.searchParams.delete(param);
    });

    // Also normalize the hash (some feeds include timestamps there)
    u.hash = '';

    return u.toString();
  } catch {
    return url;
  }
}
