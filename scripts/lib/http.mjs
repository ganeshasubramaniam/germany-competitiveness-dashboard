const DEFAULT_TIMEOUT = 15_000;

export async function fetchWithRetry(url, options = {}) {
  const {
    attempts = 3,
    timeout = DEFAULT_TIMEOUT,
    headers = {},
    ...fetchOptions
  } = options;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          "user-agent": "GermanyCompetitivenessDashboard/1.0 (+GitHub Pages)",
          ...headers,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`Unable to fetch ${url}`);
}

export async function fetchJson(url, options) {
  const response = await fetchWithRetry(url, options);
  return response.json();
}

export async function fetchText(url, options) {
  const response = await fetchWithRetry(url, options);
  return response.text();
}
