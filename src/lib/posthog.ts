import posthog from 'posthog-js';

export const initPostHog = () => {
  posthog.init('phc_U2c67Ff4NhXw0u9w5zcFQHWj3ijas9TJB776hzqCDaj', {
    api_host: 'https://eu.i.posthog.com',
    capture_pageview: false, // Manual SPA tracking
    capture_pageleave: true, // Auto time-on-page
    autocapture: true,
    persistence: 'localStorage+cookie',
  });
};

export { posthog };
