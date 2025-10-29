/**
 * Promidata API Client
 * HTTP client with automatic retry, exponential backoff, and rate limiting handling
 */

import fetch, { Response, RequestInit } from 'node-fetch';

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  retryOn4xx?: boolean; // Retry on 4xx errors (default: false, except 429)
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  retryOn4xx: false,
};

/**
 * Promidata HTTP Client
 * Handles all HTTP communication with Promidata API
 */
class PromidataClient {
  /**
   * Delay utility for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number
  ): number {
    const delay = Math.pow(2, attempt) * baseDelay;
    return Math.min(delay, maxDelay);
  }

  /**
   * Fetch with automatic retry and exponential backoff
   *
   * Handles:
   * - Rate limiting (429) - respects Retry-After header
   * - Server errors (5xx) - retries with exponential backoff
   * - Network errors - retries with exponential backoff
   * - Client errors (4xx) - fails fast (no retry)
   */
  public async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    config: RetryConfig = {}
  ): Promise<Response> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error;

    for (let attempt = 0; attempt < retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Handle rate limiting (429) - wait and retry
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after')
            ? parseInt(response.headers.get('retry-after')) * 1000
            : this.calculateBackoffDelay(attempt, retryConfig.baseDelay, retryConfig.maxDelay);

          strapi.log.warn(`[Promidata] Rate limited on ${url}. Waiting ${retryAfter}ms before retry ${attempt + 1}/${retryConfig.maxRetries}`);
          await this.delay(retryAfter);
          continue;
        }

        // Handle server errors (5xx) - retry with exponential backoff
        if (response.status >= 500) {
          const delayMs = this.calculateBackoffDelay(attempt, retryConfig.baseDelay, retryConfig.maxDelay);
          strapi.log.warn(`[Promidata] Server error ${response.status} on ${url}. Retrying in ${delayMs}ms (${attempt + 1}/${retryConfig.maxRetries})`);
          await this.delay(delayMs);
          continue;
        }

        // Client errors (4xx except 429) - fail fast unless configured otherwise
        if (response.status >= 400 && response.status < 500) {
          if (!retryConfig.retryOn4xx) {
            throw new Error(`Client error ${response.status}: ${response.statusText}`);
          } else {
            // Retry 4xx if explicitly configured
            const delayMs = this.calculateBackoffDelay(attempt, retryConfig.baseDelay, retryConfig.maxDelay);
            strapi.log.warn(`[Promidata] Client error ${response.status} on ${url}. Retrying in ${delayMs}ms (${attempt + 1}/${retryConfig.maxRetries})`);
            await this.delay(delayMs);
            continue;
          }
        }

        // Success - return response
        if (response.ok) {
          if (attempt > 0) {
            console.info(`[Promidata] ✓ Success on retry ${attempt + 1} for ${url}`);
          }
          return response;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error;

        // Network errors or other exceptions - retry with backoff
        if (attempt < retryConfig.maxRetries - 1) {
          const delayMs = this.calculateBackoffDelay(attempt, retryConfig.baseDelay, retryConfig.maxDelay);
          strapi.log.warn(`[Promidata] Network error on ${url}: ${error.message}. Retrying in ${delayMs}ms (${attempt + 1}/${retryConfig.maxRetries})`);
          await this.delay(delayMs);
        }
      }
    }

    // All retries exhausted
    const errorMessage = `Failed after ${retryConfig.maxRetries} retries: ${lastError.message}`;
    strapi.log.error(`[Promidata] ✗ ${errorMessage} for ${url}`);
    throw new Error(errorMessage);
  }

  /**
   * Fetch JSON with automatic parsing
   */
  public async fetchJSON<T = any>(
    url: string,
    options: RequestInit = {},
    config: RetryConfig = {}
  ): Promise<T> {
    const response = await this.fetchWithRetry(url, options, config);
    return response.json() as Promise<T>;
  }

  /**
   * Fetch text content
   */
  public async fetchText(
    url: string,
    options: RequestInit = {},
    config: RetryConfig = {}
  ): Promise<string> {
    const response = await this.fetchWithRetry(url, options, config);
    return response.text();
  }

  /**
   * Fetch binary data (for images, etc.)
   */
  public async fetchBuffer(
    url: string,
    options: RequestInit = {},
    config: RetryConfig = {}
  ): Promise<Buffer> {
    const response = await this.fetchWithRetry(url, options, config);
    return response.buffer();
  }

  /**
   * HEAD request (check if resource exists without downloading)
   */
  public async head(
    url: string,
    options: RequestInit = {},
    config: RetryConfig = {}
  ): Promise<Response> {
    return this.fetchWithRetry(url, { ...options, method: 'HEAD' }, config);
  }
}

// Export singleton instance
export default new PromidataClient();
