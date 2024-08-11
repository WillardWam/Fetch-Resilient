# Fetch Resilient

Fetch Resilient is a lightweight and powerful TypeScript library for making HTTP requests with advanced features such as retries, caching, throttling, and debouncing. It's designed to enhance the reliability and performance of your web applications while keeping things simple.

## Features

- **No external dependencies** - uses the built-in `fetch` API
- **Automatic retries** with configurable backoff strategy
- **Built-in caching** using IndexedDB
- **Request throttling** to limit the rate of API calls
- **Request debouncing** to prevent excessive API calls
- **Customizable error handling** and response processing
- **TypeScript support** for improved developer experience

## Installation

```bash
npm install fetch-resilient
```

## Basic Usage

Here's a simple example of how to use Fetch Resilient:

```typescript
import { httpClient } from 'fetch-resilient';

async function fetchData() {
  try {
    const data = await httpClient.fetch<{ message: string }>('https://api.example.com/data', {
      method: 'GET',
    });
    console.log(data.message);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();
```

## Global Configuration

You can set up global configuration for all requests using the `updateConfig` method:

```typescript
import { httpClient } from 'fetch-resilient';

httpClient.updateConfig({
  maxRetries: 3,
  initialBackoff: 1000,
  maxBackoff: 10000,
  backoffFactor: 2,
  retryOnErrors: [500, 502, 503, 504],
  withCache: true,
  cacheTTL: 60000, // Cache for 1 minute
  onRetry: (attempt, url, options) => {
    console.log(`Retrying request (attempt ${attempt}): ${url}`);
  },
  onHttpResponse: (response) => {
    console.log(`Response status: ${response.status}`);
  },
  onSuccess: (data, response) => {
    console.log('Request successful');
    return data;
  },
  onError: (error, attempt) => {
    console.error(`Error on attempt ${attempt}:`, error);
  },
});
```

## Using ResilientHttpClient Directly

If you prefer more control, you can use the `ResilientHttpClient` class directly:

```typescript
import { ResilientHttpClient } from 'fetch-resilient';

const client = ResilientHttpClient.getInstance({
  maxRetries: 3,
  initialBackoff: 500,
  maxBackoff: 10000,
  backoffFactor: 2,
  retryOnErrors: [404, 500],
  withCache: true,
  cacheTTL: 60000, // Cache for 1 minute
});

async function fetchData() {
  try {
    const data = await client.fetch<{ message: string }>('https://api.example.com/data', {
      method: 'GET',
    });
    console.log(data.message);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();
```

## Advanced Configuration

Fetch Resilient offers a wide range of configuration options:

```typescript
const client = ResilientHttpClient.getInstance({
  maxRetries: 3,
  initialBackoff: 500,
  maxBackoff: 10000,
  backoffFactor: 2,
  retryOnErrors: [404, 500],
  isTextResponse: false,
  isJsonResponse: false,
  responseType: 'auto',
  withCache: true,
  cacheTTL: 60000, // Cache for 1 minute
  throttleTime: 1000,
  debounceTime: 0,
  onRetry: (attempt, url, options) => {
    console.log(`Retrying request (attempt ${attempt}): ${url}`);
  },
  onHttpResponse: (response) => {
    console.log(`Response status: ${response.status}`);
  },
  onSuccess: (data, response) => {
    console.log('Request successful');
    return data;
  },
  onError: (error, attempt) => {
    console.error(`Error on attempt ${attempt}:`, error);
  },
});
```

## Caching

To enable caching, use the `withCache` option:

```typescript
const data = await client.fetch<UserData>('https://api.example.com/user/1', 
  { method: 'GET' },
  { withCache: true, cacheTTL: 60000 } // Cache for 1 minute
);
```

## Throttling

To throttle requests, use the `throttleTime` option:

```typescript
const client = ResilientHttpClient.getInstance({
  throttleTime: 5000, // Allow one request every 5 seconds
});

// This will execute immediately
client.fetch('https://api.example.com/data1');

// This will be delayed by 5 seconds
client.fetch('https://api.example.com/data2');
```

## Debouncing

To debounce requests, use the `debounceTime` option:

```typescript
const client = ResilientHttpClient.getInstance({
  debounceTime: 1000, // Wait for 1 second of inactivity before sending the request
});

// Only the last call within the debounce time will be executed
client.fetch('https://api.example.com/search?q=test1');
client.fetch('https://api.example.com/search?q=test2');
client.fetch('https://api.example.com/search?q=test3');
```

## Error Handling

Fetch Resilient provides flexible error handling:

```typescript
const client = ResilientHttpClient.getInstance({
  onError: (error, attempt) => {
    if (attempt === 3) {
      // Custom logic for final retry attempt
      console.error('Final retry attempt failed:', error);
    }
    // You can modify the error or perform additional actions
    return new Error(`Custom error: ${error.message}`);
  },
});
```

## TypeScript Support

Fetch Resilient is written in TypeScript and provides full type support:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user = await client.fetch<User>('https://api.example.com/user/1');
console.log(user.name); // TypeScript knows the shape of 'user'
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.