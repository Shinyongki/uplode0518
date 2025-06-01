// API 호출을 위한 공통 함수들

// 기본 API URL
const API_URL = '/api';
const AUTH_URL = '/auth';

// 기본 요청 옵션
const defaultOptions = {
  headers: {
    'Content-Type': 'application/json'
  }
};

// API 오류 처리
const handleApiError = (error) => {
  console.error('API 오류:', error);
  alert(error.message || '서버와 통신 중 오류가 발생했습니다.');
};

// API 호출 기본 함수
const api = {
  // 기본 API 호출 함수
  call: async (method, endpoint, data = null, options = {}) => {
    try {
      console.log('API 호출 전 인증 상태 확인');
      
      // 인증 헤더 가져오기 - window.getAuthHeaders 함수 사용
      let headers;
      if (typeof window.getAuthHeaders === 'function') {
        headers = window.getAuthHeaders();
      } else {
        console.error('getAuthHeaders 함수를 찾을 수 없습니다.');
        headers = { 'Content-Type': 'application/json' };
      }
      
      const url = endpoint.startsWith('http') ? endpoint : endpoint.startsWith('/') ? endpoint : `${API_URL}/${endpoint}`;
      
      // 요청 옵션 구성
      const fetchOptions = {
        method,
        headers,
        ...options
      };
      
      // POST, PUT 요청인 경우 body 추가
      if (data && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = JSON.stringify(data);
      }
      
      // API 호출
      const response = await fetch(url, fetchOptions);
      
      // 로그인이 필요한 경우
      if (response.status === 401) {
        console.log('API 호출 중 인증 오류 발생 (401)');
        
        // 로그인 페이지로 리디렉션
        if (window.location.pathname !== '/' && !window.location.pathname.includes('login')) {
          alert('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
          window.location.href = '/';
          return { status: 'error', message: '인증이 필요합니다.' };
        }
      }
      
      // 응답이 JSON 형식인지 확인
      const contentType = response.headers.get('content-type');
      
      // 응답 상태 코드 확인
      if (!response.ok) {
        console.log(`API 오류: ${response.status} ${response.statusText}`);
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      try {
        // JSON 응답 처리 시도
        if (contentType && contentType.includes('application/json')) {
          const responseData = await response.json();
          return responseData;
        } else {
          // JSON이 아닌 응답 처리
          const textResponse = await response.text();
          console.log('JSON이 아닌 응답:', textResponse.substring(0, 100) + '...');
          return { status: 'success', data: textResponse };
        }
      } catch (parseError) {
        console.error('응답 파싱 오류:', parseError);
        throw new Error(`응답 파싱 오류: ${parseError.message}`);
      }
    } catch (error) {
      console.log('API 오류:', error);
      throw error;
    }
  },
  
  // HTTP GET 요청
  get: (endpoint, options = {}) => {
    try {
      return api.call('GET', endpoint, null, options);
    } catch (error) {
      console.error('GET 요청 중 오류:', error);
      throw error;
    }
  },
  
  // HTTP POST 요청
  post: (endpoint, data, options = {}) => {
    try {
      return api.call('POST', endpoint, data, options);
    } catch (error) {
      console.error('POST 요청 중 오류:', error);
      throw error;
    }
  },
  
  // HTTP PUT 요청
  put: (endpoint, data, options = {}) => {
    try {
      return api.call('PUT', endpoint, data, options);
    } catch (error) {
      console.error('PUT 요청 중 오류:', error);
      throw error;
    }
  },
  
  // HTTP DELETE 요청
  delete: (endpoint, options = {}) => {
    try {
      return api.call('DELETE', endpoint, null, options);
    } catch (error) {
      console.error('DELETE 요청 중 오류:', error);
      throw error;
    }
  }
};

// 도메인별 API 그룹화
const organizations = {
  // 모든 기관 목록 조회
  getAll: async () => {
    try {
      const response = await api.get('organizations');
      return response; // 전체 응답 객체 반환
    } catch (error) {
      console.error('전체 기관 목록 조회 중 오류:', error);
      return { 
        status: 'error', 
        message: '기관 목록을 가져오는데 실패했습니다.',
        data: { organizations: [] }
      };
    }
  },
  
  // 내 담당 기관 목록 조회
  getMy: async (checkType = '전체') => {
    try {
      // API 호출 시간 최적화를 위해 캐시 버스팅 파라미터 추가
      const response = await api.get(`organizations/my?checkType=${checkType}&_t=${Date.now()}`);
      return response.data;
    } catch (error) {
      console.error('내 담당 기관 목록 조회 중 오류:', error);
      throw error;
    }
  },
  
  // getMyOrganizations 함수 추가 - organization.js에서 호출하는 함수
  getMyOrganizations: async () => {
    try {
      // API 호출 시간 최적화를 위해 캐시 버스팅 파라미터 추가
      const response = await api.get(`organizations/my?_t=${Date.now()}`);
      return response;
    } catch (error) {
      console.error('내 담당 기관 목록 조회 중 오류:', error);
      return { 
        status: 'error', 
        message: '기관 목록을 가져오는데 실패했습니다.',
        data: { mainOrganizations: [], subOrganizations: [] }
      };
    }
  },
  
  // 기관 정보 조회
  get: async (orgCode) => {
    try {
      const response = await api.get(`organizations/${orgCode}`);
      return response.data.organization;
    } catch (error) {
      console.error(`기관 정보 조회 중 오류 (${orgCode}):`, error);
      throw error;
    }
  },
  
  // 기관 정보 수정
  update: async (orgCode, data) => {
    try {
      const response = await api.put(`organizations/${orgCode}`, data);
      return response.data;
    } catch (error) {
      console.error(`기관 정보 수정 중 오류 (${orgCode}):`, error);
      throw error;
    }
  },
  
  // 기관 추가
  add: async (data) => {
    try {
      const response = await api.post('organizations', data);
      return response.data;
    } catch (error) {
      console.error('기관 추가 중 오류:', error);
      throw error;
    }
  },
  
  // 기관 삭제
  delete: async (orgCode) => {
    try {
      const response = await api.delete(`organizations/${orgCode}`);
      return response.data;
    } catch (error) {
      console.error(`기관 삭제 중 오류 (${orgCode}):`, error);
      throw error;
    }
  }
};

// 위원회 API
const committees = {
  // 모든 위원 목록 조회
  getAll: async () => {
    try {
      const response = await api.get('committees');
      return response; // 전체 응답 객체 반환
    } catch (error) {
      console.error('위원 목록 조회 중 오류:', error);
      return { 
        status: 'error', 
        message: '위원 목록을 가져오는데 실패했습니다.',
        data: { committees: [] }
      };
    }
  },
  
  // 매칭 정보 조회
  getMatching: async () => {
    try {
      // API 호출 시간 최적화를 위해 캐시 버스팅 파라미터 추가
      const response = await api.get(`committees/matching?_t=${Date.now()}`);
      
      // 원본 데이터 저장 (디버깅용)
      if (response && response.status === 'success') {
        window.rawMatchingData = response;
      }
      
      return response;
    } catch (error) {
      console.error('위원회 매칭 정보 조회 중 오류:', error);
      return { 
        status: 'error', 
        message: '위원회 매칭 정보를 가져오는데 실패했습니다.',
        data: { matchings: [] }
      };
    }
  },
  
  // 원본 데이터 가져오기 (디버깅용)
  getRawData: async () => {
    console.log('[DEBUG] getRawData 함수 호출됨');
    
    // 이미 로드된 데이터가 있는지 확인
    if (window.rawMatchingData) {
      console.log('[DEBUG] 캐시된 매칭 데이터 사용');
      return window.rawMatchingData;
    }
    
    // 데이터가 없으면 API 호출 시도
    try {
      console.log('[DEBUG] 매칭 데이터가 없어 API 호출 시도');
      const response = await committees.getMatching();
      
      if (response && (response.status === 'success' || Array.isArray(response))) {
        console.log('[DEBUG] API 호출 성공, 데이터 반환');
        return window.rawMatchingData = response;
      } else {
        console.warn('[DEBUG] API 호출은 성공했으나 데이터 형식이 예상과 다름:', response);
        return { status: 'warning', message: '데이터 형식이 예상과 다름', data: response };
      }
    } catch (error) {
      console.error('[DEBUG] 매칭 데이터 API 호출 실패:', error);
      return { status: 'error', message: '매칭 데이터를 가져오는데 실패했습니다.', error: error.message };
    }
  },
};

// 결과보고서 API
const results = {
  // 내 결과보고서 목록 조회
  getMy: async () => {
    try {
      const response = await api.get(`results/me?_t=${Date.now()}`);
      return response.data.results;
    } catch (error) {
      console.error('내 결과보고서 목록 조회 중 오류:', error);
      throw error;
    }
  },
  
  // 기관별 지표 결과 조회
  getResultsByOrganization: async (orgCode) => {
    try {
      console.log(`기관 코드 ${orgCode}의 지표 결과 조회 시도`);
      const response = await api.get(`results/organization/${orgCode}?_t=${Date.now()}`);
      return response;
    } catch (error) {
      console.error(`기관 코드 ${orgCode}의 지표 결과 조회 중 오류:`, error);
      // 오류 발생 시 빈 결과 반환
      return { status: 'error', data: { results: [] } };
    }
  },
  
  // 지표 결과 저장
  saveMonitoringResult: async (resultData) => {
    try {
      console.log('지표 결과 저장 시도:', resultData);
      const response = await api.post('results', resultData);
      return response;
    } catch (error) {
      console.error('지표 결과 저장 중 오류:', error);
      return { status: 'error', message: '지표 결과 저장에 실패했습니다.' };
    }
  }
};

// 일정 관리 API
const schedules = {
  // 일정 조회
  getAll: async (startDate, endDate) => {
    try {
      const params = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
      const response = await api.get(`schedules${params}`);
      return response.data.schedules;
    } catch (error) {
      console.error('일정 조회 중 오류:', error);
      throw error;
    }
  }
};

// API 객체 내보내기
window.api = { ...api, organizations, committees, results, schedules };

// resultApi 객체 생성 - indicator.js에서 사용
// 기존 results 객체를 사용하여 호환성 유지
window.resultApi = results;