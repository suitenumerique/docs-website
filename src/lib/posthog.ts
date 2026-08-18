import posthog from 'posthog-js';

// Project token is a public, client-side identifier (not a secret) —
// safe to ship in the bundle. See https://posthog.com/docs/product-analytics/installation
const POSTHOG_TOKEN = 'phc_AGfiDf5iix6BVXP9RBkxj6DKzqvHsMjcE3AyLgQSiBez';

posthog.init(POSTHOG_TOKEN, {
  api_host: 'https://eu.i.posthog.com',
  ui_host: 'https://eu.posthog.com',
  // No cookie banner on this site yet, so avoid writing cookies —
  // localStorage-only persistence keeps visitors identifiable across
  // pages/sessions on this device without a third-party cookie.
  persistence: 'localStorage',
  person_profiles: 'identified_only',
});
