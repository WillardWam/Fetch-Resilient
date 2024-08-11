type CacheEntry<T> = {
    key: string;
    value: T;
    expiresAt: number;
  };
  
  export class CacheManager {
    private static instance: CacheManager;
    private dbName: string;
    private version: number;
    public db: IDBDatabase | null;
    private EXPIRATION_TIME: number;
    private indexedDB: IDBFactory | null;
  
    private constructor(dbName: string = 'CACHE_DB', version: number = 1, indexedDB?: IDBFactory) {
      this.dbName = dbName;
      this.version = version;
      this.db = null;
      this.EXPIRATION_TIME = 15 * 60 * 1000;
      this.indexedDB = indexedDB || (typeof window !== 'undefined' ? window.indexedDB : null);
      if (this.indexedDB) {
        this.init();
      } else {
        // console.warn('IndexedDB is not supported in this environment. Caching will be disabled.');
      }
    }
  
    public static getInstance(dbName?: string, version?: number, indexedDB?: IDBFactory): CacheManager {
      if (!CacheManager.instance) {
        CacheManager.instance = new CacheManager(dbName, version, indexedDB);
      }
      return CacheManager.instance;
    }
  
    private async init(): Promise<void> {
      if (this.indexedDB) {
        await this.getDB();
        await this.cleanupExpiredData();
      }
    }
  
    private async getDB(): Promise<IDBDatabase | null> {
      if (!this.indexedDB) return null;
      if (this.db) return this.db;
      return new Promise((resolve, reject) => {
        const request: IDBOpenDBRequest = this.indexedDB!.open(this.dbName, this.version);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'key' });
          }
        };
      });
    }
  
    public async set<T>(key: string, value: T, expirationTime: number = this.EXPIRATION_TIME): Promise<void> {
      if (!this.indexedDB) return;
      const db = await this.getDB();
      if (!db) return;
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const expiresAt = Date.now() + expirationTime;
      await store.put({ key, value, expiresAt });
    }
  
    public async get<T>(key: string): Promise<T | null> {
      if (!this.indexedDB) return null;
      const db = await this.getDB();
      if (!db) return null;
      const transaction = db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const data = request.result as CacheEntry<T> | undefined;
          if (data && data.expiresAt > Date.now()) {
            resolve(data.value);
          } else {
            resolve(null);
          }
        };
      });
    }
  
    public async cleanupExpiredData(): Promise<void> {
      if (!this.indexedDB) return;
      const db = await this.getDB();
      if (!db) return;
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            if (cursor.value.expiresAt <= Date.now()) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }
  
    public async invalidateByKeyContaining(value: string): Promise<void> {
      if (!this.indexedDB) return;
      const db = await this.getDB();
      if (!db) return;
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            if (cursor.key.toString().includes(value)) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }

    public async invalidateAllCache(): Promise<void> {
      if (!this.indexedDB) return;
      const db = await this.getDB();
      if (!db) return;
  
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
  
      return new Promise((resolve) => {
        const request = store.clear();
  
        request.onerror = () => {
          // console.error(`Error clearing cache in ${this.dbName}:`, request.error);
          resolve();
        };
  
        request.onsuccess = () => {
          // console.log(`Cache in ${this.dbName} successfully cleared`);
          resolve();
        };
      });
    }

  }
  
  export const cacheManager = CacheManager.getInstance();