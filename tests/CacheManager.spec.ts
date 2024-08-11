// import { CacheManager } from '../src/CacheManager';

// describe('CacheManager', () => {
//   let mockIndexedDB: IDBFactory;
//   let consoleWarnSpy: jest.SpyInstance;

//   beforeEach(() => {
//     mockIndexedDB = {
//       open: jest.fn().mockReturnValue({
//         onupgradeneeded: null,
//         onsuccess: null,
//         onerror: null,
//       }),
//     } as unknown as IDBFactory;
//     consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
//   });

//   afterEach(() => {
//     consoleWarnSpy.mockRestore();
//   });

//   it('should be defined', () => {
//     const cacheManager = CacheManager.getInstance('TEST_DB', 1, mockIndexedDB);
//     expect(cacheManager).toBeDefined();
//   });

//   it('should call indexedDB.open when initialized with indexedDB available', () => {
//     CacheManager.getInstance('TEST_DB', 1, mockIndexedDB);
//     expect(mockIndexedDB.open).toHaveBeenCalledWith('TEST_DB', 1);
//   });

//   it('should log a warning when indexedDB is not available', () => {
//     CacheManager.getInstance('TEST_DB', 1, null as unknown as IDBFactory);
//     expect(consoleWarnSpy).toHaveBeenCalledWith('IndexedDB is not supported in this environment. Caching will be disabled.');
//   });

//   // Add more tests here for set, get, and other methods
// });