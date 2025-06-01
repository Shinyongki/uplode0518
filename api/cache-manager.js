/**
 * 간단한 메모리 기반 캐시 시스템
 * API 장애 시 fallback으로 사용할 최근 데이터 저장
 */

// 캐시 저장소
const cache = {
  data: {},
  timestamp: {}
};

/**
 * 캐시에 데이터 저장
 * @param {string} key - 캐시 키
 * @param {any} data - 저장할 데이터
 * @param {number} ttl - 캐시 유효 시간(밀리초), 기본값 1시간
 */
function set(key, data, ttl = 3600000) {
  if (!key || data === undefined) return false;
  
  try {
    cache.data[key] = JSON.stringify(data);
    cache.timestamp[key] = {
      created: Date.now(),
      expires: Date.now() + ttl,
      source: 'google-sheets' // 데이터 출처 표시
    };
    
    console.log(`[cache] Data cached for key: ${key}`);
    return true;
  } catch (error) {
    console.error(`[cache] Error caching data for key ${key}:`, error.message);
    return false;
  }
}

/**
 * 캐시에서 데이터 가져오기
 * @param {string} key - 캐시 키
 * @param {boolean} ignoreExpiry - 만료 여부 무시 (기본값: false)
 * @returns {object|null} 캐시된 데이터 또는 null
 */
function get(key, ignoreExpiry = false) {
  if (!key || !cache.data[key]) return null;
  
  try {
    // 만료 여부 확인 (ignoreExpiry가 true면 무시)
    if (!ignoreExpiry && cache.timestamp[key].expires < Date.now()) {
      console.log(`[cache] Cache expired for key: ${key}`);
      return null;
    }
    
    console.log(`[cache] Cache hit for key: ${key}`);
    return {
      data: JSON.parse(cache.data[key]),
      timestamp: cache.timestamp[key]
    };
  } catch (error) {
    console.error(`[cache] Error retrieving cache for key ${key}:`, error.message);
    return null;
  }
}

/**
 * 캐시된 데이터의 정보 확인
 * @param {string} key - 캐시 키
 * @returns {object|null} 캐시 메타데이터 또는 null
 */
function getInfo(key) {
  if (!key || !cache.timestamp[key]) return null;
  
  return {
    ...cache.timestamp[key],
    exists: !!cache.data[key],
    isExpired: cache.timestamp[key].expires < Date.now()
  };
}

/**
 * 모든 캐시 키 목록 가져오기
 * @returns {string[]} 캐시 키 배열
 */
function getKeys() {
  return Object.keys(cache.data);
}

/**
 * 특정 키의 캐시 삭제
 * @param {string} key - 삭제할 캐시 키
 */
function remove(key) {
  if (!key) return;
  
  delete cache.data[key];
  delete cache.timestamp[key];
  console.log(`[cache] Removed cache for key: ${key}`);
}

/**
 * 만료된 모든 캐시 정리
 */
function clearExpired() {
  const now = Date.now();
  let count = 0;
  
  Object.keys(cache.timestamp).forEach(key => {
    if (cache.timestamp[key].expires < now) {
      delete cache.data[key];
      delete cache.timestamp[key];
      count++;
    }
  });
  
  console.log(`[cache] Cleared ${count} expired cache entries`);
}

module.exports = {
  set,
  get,
  getInfo,
  getKeys,
  remove,
  clearExpired
}; 