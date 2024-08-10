// CacheManager.ts

interface CacheEntry<T> {
    key: string;
    value: T;
    expiresAt: number;
}

export class CacheManager {
    private static instance: CacheManager;
    private dbName: string;
    private version: number;
    private db: IDBDatabase | null;
    private EXPIRATION_TIME: number;

    private constructor(dbName: string = 'CACHE_DB', version: number = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.EXPIRATION_TIME = 15 * 60 * 1000; // 15 minutes
        this.init();
    }

    public static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    private async init(): Promise<void> {
        await this.getDB();
        await this.cleanupExpiredData();
    }

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request: IDBOpenDBRequest = indexedDB.open(this.dbName, this.version);

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
        const db = await this.getDB();
        const transaction = db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');

        const expiresAt = Date.now() + expirationTime;
        await store.put({ key, value, expiresAt });
    }

    public async get<T>(key: string): Promise<T | null> {
        const db = await this.getDB();
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

    private async cleanupExpiredData(): Promise<void> {
        const db = await this.getDB();
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
}

export const cacheManager = CacheManager.getInstance();