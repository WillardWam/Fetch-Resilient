import { cacheManager } from "./CacheManager";

export interface ResilientHttpConfig {
  maxRetries: number;
  initialBackoff: number;
  maxBackoff: number;
  backoffFactor: number;
  retryOnErrors: number[];
  onRetry?: (attempt: number, url: string, options: RequestInit) => { url?: string; options?: RequestInit } | void;
  onHttpResponse?: (response: Response) => void;
  onSuccess?: <T>(data: T, response: Response) => T | Promise<T> | void;
  onError?: (error: Error, attempt: number) => Error | void;
  isTextResponse?: boolean;
  isJsonResponse?: boolean;
  responseType?: 'json' | 'text' | 'auto';
  withCache: boolean;
  cacheTTL?: number;
  cacheKey?: string;
  throttleTime: number;
  debounceTime: number;
  url: string;
  testCallback?: (url: string, options: RequestInit, config: ResilientHttpConfig) => Promise<Response>;
}

export class ResilientHttpClient {
  private static instance: ResilientHttpClient;
  private config: ResilientHttpConfig;
  private debounceTimers: Map<string, number>;
  private lastExecutionTime: Map<string, number>;
  private inFlightRequests: Map<string, Promise<any>>;

  private constructor(config: Partial<ResilientHttpConfig> = {}) {
    this.config = {
      maxRetries: 3,
      initialBackoff: 500,
      maxBackoff: 10000,
      backoffFactor: 2,
      retryOnErrors: [404, 500],
      isTextResponse: false,
      isJsonResponse: false,
      responseType: 'auto',
      withCache: false,
      throttleTime: 0,
      debounceTime: 0,
      url: "",
      ...config
    };

    this.debounceTimers = new Map();
    this.lastExecutionTime = new Map();
    this.inFlightRequests = new Map();
  }

  public static getInstance(config: Partial<ResilientHttpConfig> = {}): ResilientHttpClient {
    if (!ResilientHttpClient.instance) {
      ResilientHttpClient.instance = new ResilientHttpClient(config);
    }
    return ResilientHttpClient.instance;
  }

  public static resetInstance(): void {
    ResilientHttpClient.instance = new ResilientHttpClient();
  }

  public updateConfig(config: Partial<ResilientHttpConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async fetch<T>(
    url: string, 
    options: RequestInit = {}, 
    config: Partial<ResilientHttpConfig> = {}
  ): Promise<T> {
    const mergedConfig = { ...this.config, ...config, url };

    if (mergedConfig.testCallback) {
      const response = await mergedConfig.testCallback(url, options, mergedConfig);
      return this.processResponse<T>(response, mergedConfig);
    }

    if (mergedConfig.withCache) {
      const cacheKey = this.generateCacheKey(url, mergedConfig.cacheKey);
      const cachedData = await cacheManager.get<T>(cacheKey);
      if (cachedData) return cachedData;
    }
    
    if (mergedConfig.throttleTime > 0) {
      return this.throttledFetch<T>(url, options, mergedConfig);
    } else if (mergedConfig.debounceTime > 0) {
      return this.debouncedFetch<T>(url, options, mergedConfig);
    } else {
      return this.executeFetch<T>(url, options, mergedConfig);
    }
  }

  private generateCacheKey(url: string, cacheKey?: string): string {
    return cacheKey ? `${cacheKey}` : `${url}`;
  }

  private async throttledFetch<T>(url: string, options: RequestInit, config: ResilientHttpConfig): Promise<T> {
    const key = JSON.stringify({ url, options });
    const currentTime = Date.now();
    const lastExecution = this.lastExecutionTime.get(key) || 0;
    const timeSinceLastExecution = currentTime - lastExecution;

    if (timeSinceLastExecution < config.throttleTime) {
      // Check if there's an in-flight request
      const inFlightRequest = this.inFlightRequests.get(key);
      if (inFlightRequest) {
        // Return the existing in-flight request
        return inFlightRequest;
      }
      
      // If no in-flight request, wait for the throttle time
      await new Promise(resolve => setTimeout(resolve, config.throttleTime - timeSinceLastExecution));
    }

    // Create a new request and store it
    const request = this.executeFetch<T>(url, options, config);
    this.inFlightRequests.set(key, request);
    this.lastExecutionTime.set(key, currentTime);

    try {
      const result = await request;
      return result;
    } finally {
      // Remove the in-flight request after it's completed
      this.inFlightRequests.delete(key);
    }
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

        if (config.onRetry && attempt > 0) {
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

        return await this.processResponse<T>(response, config);
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

  private async processResponse<T>(response: Response, config: ResilientHttpConfig): Promise<T> {
    let data: T;

    try {
      if (config.isTextResponse) {
        data = await response.text() as unknown as T;
      } else if (config.isJsonResponse) {
        data = await response.json() as T;
      } else {
        switch (config.responseType) {
          case 'text':
            data = await response.text() as unknown as T;
            break;
          case 'json':
            data = await response.json() as T;
            break;
          case 'auto':
          default:
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              data = await response.json() as T;
            } else {
              data = await response.text() as unknown as T;
            }
            break;
        }
      }
    } catch (error) {
      throw new Error("Invalid response format");
    }

    if (config.onSuccess) {
      try {
        const modifiedData = await Promise.resolve(config.onSuccess(data, response));
        if (modifiedData !== undefined) {
          data = modifiedData as T;
        }
      } catch (error) {
        throw error;
      }
    }

    if (config.withCache) {
      const cacheKey = this.generateCacheKey(config.url, config.cacheKey);
      await cacheManager.set(cacheKey, data, config.cacheTTL);
    }

    return data;
  }
}

export const httpClient = ResilientHttpClient.getInstance();