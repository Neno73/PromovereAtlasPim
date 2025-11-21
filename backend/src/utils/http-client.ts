/**
 * HTTP Client Utility with Retry Logic
 * Provides resilient HTTP calls with exponential backoff for transient failures
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

/**
 * Create an axios instance with retry logic
 * @param config Optional axios configuration
 * @param retries Number of retry attempts (default: 3)
 * @param retryDelay Exponential backoff multiplier in ms (default: 1000)
 */
export function createResilientHttpClient(
    config: AxiosRequestConfig = {},
    retries: number = 3,
    retryDelay: number = 1000
): AxiosInstance {
    const client = axios.create(config);

    // Configure retry logic
    axiosRetry(client, {
        retries,
        retryDelay: (retryCount) => {
            // Exponential backoff: 1s, 2s, 4s, etc.
            return retryCount * retryDelay;
        },
        retryCondition: (error) => {
            // Retry on network errors, 5xx server errors, or rate limits (429)
            return (
                axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                (error.response?.status >= 500 && error.response?.status < 600) ||
                error.response?.status === 429
            );
        },
        onRetry: (retryCount, error, requestConfig) => {
            strapi.log.warn(
                `[HTTP Retry] Attempt ${retryCount} for ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`,
                { error: error.message }
            );
        },
    });

    return client;
}

/**
 * Pre-configured client for Gemini API calls
 */
export const geminiHttpClient = createResilientHttpClient(
    {
        timeout: 30000, // 30 seconds
        headers: {
            'Content-Type': 'application/json',
        },
    },
    3, // 3 retries
    2000 // 2 second base delay
);

/**
 * Pre-configured client for Promidata API calls
 */
export const promidataHttpClient = createResilientHttpClient(
    {
        timeout: 60000, // 60 seconds (large product catalogs)
        headers: {
            'Content-Type': 'application/json',
        },
    },
    3, // 3 retries
    1000 // 1 second base delay
);
