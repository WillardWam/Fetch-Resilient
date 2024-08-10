import { cacheManager } from "./CacheManager";

export interface ResilientHttpConfig {
  maxRetries: number;
  initialBackoff: number;
  maxBackoff: number;
  backoffFactor: number;
  retryOnErrors: number[];
  onRetry?: (attempt: number, url: string, options: RequestInit) => { url?: string; options?: RequestInit } | void;
  onHttpResponse?: (response: Response) => void;
  onSuccess?: <T>(data: T, response: Response) => T | void;
  onError?: (error: Error, attempt: number) => Error | void;
  isTextResponse: boolean;
  withCache: boolean;
  cacheTTL?: number;
  throttle: boolean;
  throttleTime: number;
  debounce: boolean;
  debounceTime: number;
}

export class ResilientHttpClient {
  private config: ResilientHttpConfig;
  private debounceTimers: Map<string, number>;
  private lastExecutionTime: Map<string, number>;

  constructor(config: Partial<ResilientHttpConfig> = {}) {
    this.config = {
      maxRetries: 3,
      initialBackoff: 500,
      maxBackoff: 10000,
      backoffFactor: 2,
      retryOnErrors: [404, 500],
      isTextResponse: false,
      withCache: false,
      throttle: false,
      throttleTime: 1000,
      debounce: false,
      debounceTime: 1000,
      ...config
    };

    this.debounceTimers = new Map();
    this.lastExecutionTime = new Map();
  }

  async fetch<T>(url: string, options: RequestInit = {}, config: Partial<ResilientHttpConfig> = {}): Promise<T> {
    const mergedConfig = { ...this.config, ...config };
    
    if (mergedConfig.withCache) {
      const cacheKey = this.generateCacheKey(url, options.headers);
      const cachedData = await cacheManager.get<T>(cacheKey);
      if (cachedData) return cachedData;
    }
    
    if (mergedConfig.throttle) {
      return this.throttledFetch<T>(url, options, mergedConfig);
    } else if (mergedConfig.debounce) {
      return this.debouncedFetch<T>(url, options, mergedConfig);
    } else {
      return this.executeFetch<T>(url, options, mergedConfig);
    }
  }

  private generateCacheKey(url: string, headers?: HeadersInit): string {
    const headerString = headers ? JSON.stringify(headers) : '';
    return `${url}|${headerString}`;
  }

  private async throttledFetch<T>(url: string, options: RequestInit, config: ResilientHttpConfig): Promise<T> {
    const key = JSON.stringify({ url, options });
    const currentTime = Date.now();
    const lastExecution = this.lastExecutionTime.get(key) || 0;
    const timeSinceLastExecution = currentTime - lastExecution;

    if (timeSinceLastExecution < config.throttleTime) {
      console.log(`Request throttled. Next execution in ${config.throttleTime - timeSinceLastExecution}ms`);
      return Promise.reject(new Error('Request throttled'));
    }

    this.lastExecutionTime.set(key, currentTime);

    const data = await this.executeFetch<T>(url, options, config);
    return data;
  }

  private debouncedFetch<T>(url: string, options: RequestInit, config: ResilientHttpConfig): Promise<T> {
    return new Promise((resolve, reject) => {
      const key = JSON.stringify({ url, options });

      const executeRequest = async () => {
        this.lastExecutionTime.set(key, Date.now());
        try {
          const data = await this.executeFetch<T>(url, options, config);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };

      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }

      console.log(`Request debounced. Execution scheduled in ${config.debounceTime}ms`);
      const timerId = setTimeout(executeRequest, config.debounceTime);
      this.debounceTimers.set(key, timerId as unknown as number);
    });
  }

  private async executeFetch<T>(url: string, options: RequestInit, config: ResilientHttpConfig): Promise<T> {
    let attempt = 0;
    while (attempt < config.maxRetries) {
      try {
        let currentUrl = url;
        let currentOptions = { ...options };

        if (config.onRetry) {
          const result = config.onRetry(attempt, currentUrl, currentOptions);
          if (result) {
            currentUrl = result.url || currentUrl;
            currentOptions = result.options || currentOptions;
          }
        }

        const response = await fetch(currentUrl, currentOptions);

        if (config.onHttpResponse) {
          config.onHttpResponse(response);
        }

        if (!response.ok && config.retryOnErrors.includes(response.status)) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        let data: T = config.isTextResponse ? await response.text() as unknown as T : await response.json();

        if (config.onSuccess) {
          const modifiedData = config.onSuccess(data, response);
          if (modifiedData !== undefined) {
            data = modifiedData as T;
          }
        }

        // Save the response in cache if caching is enabled
        if (config.withCache) {
          const cacheKey = this.generateCacheKey(url, currentOptions.headers);
          await cacheManager.set(cacheKey, data, config.cacheTTL);
        }

        return data;
      } catch (error) {
        attempt++;

        if (config.onError) {
          const modifiedError = config.onError(error as Error, attempt);
          if (modifiedError) {
            throw modifiedError;
          }
        }

        if (attempt >= config.maxRetries) {
          throw error;
        }

        const backoffTime = Math.min(
          config.initialBackoff * Math.pow(config.backoffFactor, attempt),
          config.maxBackoff
        );
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
    throw new Error("Max retries exceeded");
  }
}