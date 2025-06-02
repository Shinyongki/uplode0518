// 기관 관련 함수들

// 현재 선택된 기관 정보
let selectedOrganization = null;

// 전역 변수
// 현재 로딩 중인지 표시
let isLoadingOrganizations = false;
// 마지막 로드 시간
let lastLoadTime = 0;

// 기관 코드와 기관명 매핑 테이블
const orgCodeNameMap = {
  // 신용기 위원 담당 기관
  'A48170002': '진주노인통합지원센터',
  'A48820003': '대한노인회 고성군지회(노인맞춤돌봄서비스)',
  'A48820004': '한올생명의집',
  'A48170003': '나누리노인통합지원센터',
  'A48240001': '사랑원노인지원센터',
  'A48240002': '사천노인통합지원센터',
  'A48840001': '화방남해노인통합지원센터',
  
  // 이연숙 위원 담당 기관
  'A48170004': '공덕의집노인통합지원센터',
  'A48270002': '밀양노인통합지원센터',
  'A48330001': '사회복지법인신생원양산재가노인복지센터',
  'A48270001': '밀양시자원봉사단체협의회',
  'A48330004': '양산행복한돌봄 사회적협동조합',
  'A48120005': '마산희망지역자활센터',
  'A48330005': '성요셈소규모노인종합센터',
  
  'A48840002': '화방재가복지센터',
  'A48170001': '진양노인통합지원센터',
  'A48850001': '하동노인통합지원센터',
  'A48850002': '경남하동지역자활센터',
  'A48880003': '거창인애노인통합지원센터',
  'A48860003': '산청해민노인통합지원센터',
  
  // 문일지 위원 담당 기관
  'A48880001': '창녕군노인복지센터',
  'A48880002': '창녕군노인지원센터',
  'A48880004': '창녕군시니어클럽',
  'A48880005': '창녕군노인재가복지센터',
  'A48880006': '창녕군지역자활센터',
  
  // 김수연 위원 담당 기관
  'A48860001': '양산시노인복지관',
  'A48860002': '양산시니어클럽',
  'A48860004': '양산노인재가복지센터',
  'A48860005': '양산시지역자활센터',
  'A48860006': '양산시노인통합지원센터',
  
  // 이영희 위원 담당 기관
  'A48720001': '통영시노인복지관',
  'A48720002': '통영시니어클럽',
  'A48720003': '통영노인종합복지센터',
  'A48720004': '통영시지역자활센터',
  'A48720005': '통영시노인통합지원센터',
  
  // 박정수 위원 담당 기관
  'A48890001': '김해시노인복지관',
  'A48890002': '김해시노인종합지원센터',
  'A48890003': '김해시니어클럽',
  'A48890004': '김해시노인재가복지센터',
  'A48890005': '김해시지역자활센터',
  'A48890006': '김해시노인통합지원센터'
};
const MIN_LOAD_INTERVAL = 2000; // 최소 2초 간격으로 API 호출 제한

// 간단한 메시지 표시 함수
const displayOrgMessage = (message, type = 'info') => {
  console.log(`${type.toUpperCase()}: ${message}`);
  
  // 메시지를 UI에 표시
  const messageContainer = document.getElementById('message-container');
  if (messageContainer) {
    // 메시지 요소 생성
    const messageElement = document.createElement('div');
    messageElement.className = `p-4 mb-4 rounded ${
      type === 'error' ? 'bg-red-100 text-red-800' : 
      type === 'success' ? 'bg-green-100 text-green-800' : 
      'bg-blue-100 text-blue-800'
    }`;
    messageElement.innerHTML = `
      <p class="mb-0">${message}</p>
    `;
    
    // 기존 메시지 삭제
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageElement);
    
    // 3초 후 메시지 삭제
    setTimeout(() => {
      messageElement.remove();
    }, 5000);
  } else {
    // 메시지 컨테이너가 없으면 alert 사용
    alert(message);
  }
};

// 구글시트 연동을 위한 함수 추가
const loadOrganizationsFromSheet = async () => {
  try {
    // 현재 로그인한 위원 정보 가져오기
    const currentUserLocal = JSON.parse(localStorage.getItem('currentCommittee') || '{}');
    const committeeName = currentUserLocal.name;
    
    if (!committeeName) {
      console.error('로그인한 위원 정보를 찾을 수 없습니다.');
      return null;
    }
    
    console.log(`${committeeName} 위원의 담당 기관 데이터를 로드합니다.`);
    
    // 로컬 스토리지에서 가져오기 시도 (캐시 확인)
    const localData = localStorage.getItem('committeeOrganizations');
    const cachedTime = localStorage.getItem('committeeOrganizationsTime');
    const lastOrgUpdateTime = localStorage.getItem('lastOrganizationUpdateTime') || '0';
    
    // 캐시가 유효한지 확인
    const now = Date.now();
    const cacheAge = cachedTime ? now - parseInt(cachedTime) : Infinity;
    
    // 기관 추가/수정 후 로그인한 경우 캐시 무시
    const lastOrgUpdate = parseInt(lastOrgUpdateTime);
    const lastLoginTime = parseInt(localStorage.getItem('lastLoginTime') || '0');
    const isAfterOrgUpdate = lastOrgUpdate > 0 && lastLoginTime > lastOrgUpdate;
    
    // 캐시 유효시간 감소 (1시간 -> 5분)
    const cacheValid = cacheAge < 300000 && !isAfterOrgUpdate; // 5분 = 300000ms
    
    if (localData && cacheValid) {
      try {
        const parsedData = JSON.parse(localData);
        console.log('로컬 스토리지 캐시에서 기관 정보 가져옴 (캐시 유효기간: ' + Math.floor(cacheAge/60000) + '분)', parsedData);
        return parsedData;
      } catch (parseError) {
        console.error('로컬 스토리지 데이터 파싱 오류:', parseError);
      }
    } else {
      console.log('캐시 무효: ' + (isAfterOrgUpdate ? '기관 추가/수정 후 로그인' : '캐시 만료'));
    }
    
    console.log('로컬 스토리지 캐시가 없거나 만료됨, 서버에서 위원별 담당 기관 데이터 가져오기 시도');
    
    // 실제 데이터를 가져오는 부분 강화
    try {
      // 1. 직접 구글 시트에서 데이터 가져오기 시도
      console.log(`구글 시트에서 ${committeeName} 위원 담당 기관 데이터 가져오기 시도`);
      const sheetResponse = await fetch(`/api/sheets-committee-orgs?committeeName=${encodeURIComponent(committeeName)}&sheet=위원별_담당기관`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (sheetResponse.ok) {
        const sheetResult = await sheetResponse.json();
        console.log('구글 시트 API 응답:', sheetResult);
        
        if (sheetResult.status === 'success' && 
            ((sheetResult.organizationObjects && 
              ((sheetResult.organizationObjects.main && sheetResult.organizationObjects.main.length > 0) || 
               (sheetResult.organizationObjects.sub && sheetResult.organizationObjects.sub.length > 0))) || 
             (sheetResult.organizations && 
              ((sheetResult.organizations.main && sheetResult.organizations.main.length > 0) || 
               (sheetResult.organizations.sub && sheetResult.organizations.sub.length > 0))))) {
          
          console.log('구글 시트에서 유효한 데이터 찾음');
          
          // 기관 데이터 추출
          let resultData = {};
          
          // 응답에 organizationObjects가 있는 경우 (개선된 형식)
          if (sheetResult.organizationObjects) {
            resultData = {
              organizations: sheetResult.organizations,
              organizationObjects: sheetResult.organizationObjects
            };
            console.log('개선된 응답 형식 처리:', resultData);
          }
          // 응답에 organizations만 있는 경우 (기존 형식)
          else if (sheetResult.organizations) {
            resultData = {
              organizations: sheetResult.organizations
            };
            console.log('기존 응답 형식 처리:', resultData);
          }
          
          // 로컬 스토리지에 저장 (캐싱)
          localStorage.setItem('committeeOrganizations', JSON.stringify(resultData));
          localStorage.setItem('committeeOrganizationsTime', now.toString());
          
          console.log(`구글 시트에서 ${committeeName} 위원 담당 기관 데이터를 성공적으로 가져와서 캐싱함`);
          return resultData;
        } else {
          console.log('구글 시트에서 유효한 데이터를 찾지 못함, 다른 방법 시도');
          throw new Error('구글 시트에서 유효한 데이터를 찾지 못함');
        }
      } else {
        console.log(`구글 시트 API 오류: ${sheetResponse.status} ${sheetResponse.statusText}`);
        throw new Error('구글 시트 API 오류');
      }
    } catch (sheetError) {
      console.warn('구글 시트 연동 실패:', sheetError.message);
      
      try {
        // 2. 위원별 담당 기관 API 호출 시도
        console.log(`위원별 담당 기관 API 호출: /api/sheets-committee-orgs?committeeName=${committeeName}`);
        const response = await fetch(`/api/sheets-committee-orgs?committeeName=${encodeURIComponent(committeeName)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`API 오류: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('위원별 담당 기관 API 응답:', result);
        
        // API 응답 구조 확인
        if (result.status === 'success') {
          // 기관 데이터 추출
          let resultData = {};
          
          // 응답에 organizationObjects가 있는 경우 (개선된 형식)
          if (result.organizationObjects) {
            resultData = {
              organizations: result.organizations,
              organizationObjects: result.organizationObjects
            };
            console.log('개선된 응답 형식 처리:', resultData);
          }
          // 응답에 organizations만 있는 경우 (기존 형식)
          else if (result.organizations) {
            resultData = {
              organizations: result.organizations
            };
            console.log('기존 응답 형식 처리:', resultData);
          }
          
          // 로컬 스토리지에 저장 (캐싱)
          localStorage.setItem('committeeOrganizations', JSON.stringify(resultData));
          localStorage.setItem('committeeOrganizationsTime', now.toString());
          
          console.log(`${committeeName} 위원 담당 기관 데이터를 성공적으로 가져와서 캐싱함`);
          return resultData;
        } else {
          throw new Error('위원별 담당 기관 API 응답 형식이 유효하지 않습니다.');
        }
      } catch (apiError) {
        console.warn('위원별 담당 기관 API 호출 실패:', apiError.message);
        
        // 3. 대체 API 호출 시도
        console.log('대체 API를 통해 기관 데이터 가져오기 시도');
        
        try {
          // 대체 API 엔드포인트 호출
          console.log(`대체 API 호출: /api/sheets-committee-orgs?committeeName=${committeeName}`);
          const altResponse = await fetch(`/api/sheets-committee-orgs?committeeName=${encodeURIComponent(committeeName)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
          
          if (!altResponse.ok) {
            throw new Error(`대체 API 오류: ${altResponse.status} ${altResponse.statusText}`);
          }
          
          const altResult = await altResponse.json();
          console.log('대체 API 응답:', altResult);
          
          if (altResult.status === 'success' && altResult.data) {
            // 대체 API에서 가져온 데이터 처리
            const matchings = altResult.data;
            
            // 주담당과 부담당 기관 분류
            const mainOrgs = matchings
              .filter(item => item.role === '주담당' || item.role === '주담당기관')
              .map(item => ({
                id: item.orgId || item.orgCode,
                code: item.orgCode,
                name: item.orgName,
                region: item.region || '경상남도'
              }));
            
            const subOrgs = matchings
              .filter(item => item.role === '부담당' || item.role === '부담당기관')
              .map(item => ({
                id: item.orgId || item.orgCode,
                code: item.orgCode,
                name: item.orgName,
                region: item.region || '경상남도'
              }));
            
            // 기관 코드 및 기관명 추출
            const mainOrgCodes = mainOrgs.map(org => org.code);
            const subOrgCodes = subOrgs.map(org => org.code);
            
            // 결과 데이터 구성
            const resultData = {
              organizations: {
                main: mainOrgCodes,
                sub: subOrgCodes
              },
              organizationObjects: {
                main: mainOrgs,
                sub: subOrgs
              }
            };
            
            // 로컬 스토리지에 저장 (캐싱)
            localStorage.setItem('committeeOrganizations', JSON.stringify(resultData));
            localStorage.setItem('committeeOrganizationsTime', now.toString());
            
            console.log('대체 API에서 위원별 담당 기관 데이터를 성공적으로 가져와서 캐싱함');
            return resultData;
          } else {
            throw new Error('대체 API 응답 형식이 유효하지 않습니다.');
          }
        } catch (altApiError) {
          console.error('대체 API 호출 실패:', altApiError);
          console.log('기존 메인 API를 통해 기관 데이터 가져오기 시도');
          
          // 모든 API 호출이 실패한 경우 기존 메인 API 호출
          return await fetchOrganizationsFromMainAPI();
        }
      }
    }
  } catch (error) {
    console.error('구글 시트 데이터 로드 실패:', error);
    return null;
  }
};

// 기존 API에서 기관 데이터 가져오기 (폴백 함수)
const fetchOrganizationsFromMainAPI = async () => {
  try {
    const response = await fetch('/api/organizations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`기존 API 오류: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('기존 API 응답:', result);
    
    let mainOrgs = [];
    let subOrgs = [];
    
    if (result.status === 'success') {
      // 다양한 API 응답 형태 처리
      if (result.organizations && result.organizations.main) {
        mainOrgs = result.organizations.main || [];
        subOrgs = result.organizations.sub || [];
      } else if (result.data && result.data.main) {
        mainOrgs = result.data.main || [];
        subOrgs = result.data.sub || [];
      }
    }
    
    // 기관 코드 추출
    const mainOrgCodes = mainOrgs.map(org => org.id || org.code || org.orgCode);
    const subOrgCodes = subOrgs.map(org => org.id || org.code || org.orgCode);
    
    const resultData = {
      organizations: {
        main: mainOrgCodes,
        sub: subOrgCodes
      }
    };
    
    // 로컬 스토리지에 저장
    localStorage.setItem('committeeOrganizations', JSON.stringify(resultData));
    localStorage.setItem('committeeOrganizationsTime', Date.now().toString());
    
    return resultData;
  } catch (error) {
    console.error('기존 API 호출 실패:', error);
    return null;
  }
};

// 기관 목록 가져오기 및 표시
const loadOrganizations = async () => {
  try {
    // 마스터 페이지인지 확인
    const isMasterPage = window.location.pathname.includes('/master') || 
                        document.getElementById('master-dashboard') !== null;
    
    // 마스터 페이지인 경우 기관 로드 스킵
    if (isMasterPage) {
      console.log('마스터 페이지에서는 기관 로드를 스킵합니다.');
      return true;
    }
    
    // API 호출 중복 방지 - 이미 로딩 중이면 무시
    if (isLoadingOrganizations) {
      console.log('기관 목록 로딩이 이미 진행 중입니다. 중복 요청 무시');
      return;
    }
    
    // 마지막 로드 시간 확인하여 너무 빈번한 API 호출 방지
    const currentTime = Date.now();
    
    // 로그인 직후인지 확인 (로그인 후 10초 이내이거나 lastLoadTime이 0인 경우 제한 우회)
    const loginTime = parseInt(localStorage.getItem('lastLoginTime') || '0');
    const isAfterLogin = currentTime - loginTime < 10000; // 로그인 후 10초 이내
    
    console.log('기관 목록 로드 진행: ' + (isAfterLogin ? '로그인 직후 요청' : '일반 요청'));
    
    // 로딩 상태 설정
    isLoadingOrganizations = true;
    lastLoadTime = currentTime;
    
    // DOM 요소 진단
    console.log('DOM 요소 진단:');
    const mainOrgsContainer = document.getElementById('main-organizations');
    const subOrgsContainer = document.getElementById('sub-organizations');
    const orgContainer = document.getElementById('organization-selection');
    const monitoringContainer = document.getElementById('monitoring-indicators');
    
    // 모든 위원의 담당 기관 코드 로드
    const currentUserLocal = JSON.parse(localStorage.getItem('currentCommittee') || '{}');
    if (currentUserLocal && currentUserLocal.name) {
      console.log(`${currentUserLocal.name} 위원 담당 기관 데이터 로드`);
      
      try {
        // 구글시트에서 데이터 가져오기
        const sheetData = await loadOrganizationsFromSheet();
        console.log('구글시트 데이터:', sheetData);
        
        if (sheetData && sheetData.organizations) {
          const committeeMainOrgCodes = sheetData.organizations.main || [];
          const committeeSubOrgCodes = sheetData.organizations.sub || [];
          
          window.committeeMainOrgCodes = committeeMainOrgCodes;
          window.committeeSubOrgCodes = committeeSubOrgCodes;
          localStorage.setItem('committeeMainOrgCodes', JSON.stringify(committeeMainOrgCodes));
          localStorage.setItem('committeeSubOrgCodes', JSON.stringify(committeeSubOrgCodes));
          
          console.log(`${currentUserLocal.name} 위원 담당 기관 코드 설정 완료:`, {
            main: committeeMainOrgCodes,
            sub: committeeSubOrgCodes
          });
        } else {
          console.error(`구글시트에서 ${currentUserLocal.name} 위원의 담당기관 데이터를 가져오는데 실패했습니다.`);
          displayOrgMessage('담당기관 데이터를 불러오는데 실패했습니다. 관리자에게 문의하세요.', 'error');
        }
      } catch (error) {
        console.error('구글시트 데이터 로드 실패:', error);
      }
    }
    
    console.log('- organization-selection 존재:', !!orgContainer);
    console.log('- monitoring-indicators 존재:', !!monitoringContainer);
    console.log('- main-organizations 존재:', !!mainOrgsContainer);
    console.log('- sub-organizations 존재:', !!subOrgsContainer);
    
    if (orgContainer) {
      console.log('- organization-selection display:', window.getComputedStyle(orgContainer).display);
    }
    
    // 컨테이너가 없는 경우 생성 시도
    if (!mainOrgsContainer && orgContainer) {
      console.log('주담당 기관 컨테이너가 없어 생성 시도');
      const newMainOrgContainer = document.createElement('div');
      newMainOrgContainer.id = 'main-organizations';
      newMainOrgContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8';
      
      // 헤더 다음에 삽입
      const header = orgContainer.querySelector('h2');
      if (header) {
        header.parentNode.insertBefore(newMainOrgContainer, header.nextSibling);
        console.log('주담당 기관 컨테이너 생성 성공');
      } else {
        orgContainer.appendChild(newMainOrgContainer);
        console.log('헤더를 찾을 수 없어 컨테이너 끝에 추가');
      }
    }
    
    // 로딩 상태 표시
    if (mainOrgsContainer) {
      mainOrgsContainer.innerHTML = '<p class="text-gray-500">기관 목록을 불러오는 중...</p>';
    } else {
      console.error('주담당 기관 컨테이너(#main-organizations)를 찾을 수 없어 로딩 상태를 표시할 수 없습니다');
    }
    
    if (subOrgsContainer) {
      subOrgsContainer.innerHTML = '<p class="text-gray-500">기관 목록을 불러오는 중...</p>';
    } else {
      console.error('부담당 기관 컨테이너(#sub-organizations)를 찾을 수 없어 로딩 상태를 표시할 수 없습니다');
    }
    
    console.log('기관 목록 로딩 시작');
    
    // 로그인 화면인지 확인
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const isLoginScreen = loginContainer && 
                        window.getComputedStyle(loginContainer).display !== 'none' &&
                        dashboardContainer && 
                        window.getComputedStyle(dashboardContainer).display === 'none';
    
    if (isLoginScreen) {
      console.log('로그인 화면이 표시되고 있어 기본 데이터 로드 중단');
      isLoadingOrganizations = false; // 로딩 상태 해제
      return false; // 로그인 화면에서는 더 이상 진행하지 않음
    }
    
    // 토큰이 설정될 때까지 잠시 대기
    // getToken 함수가 정의되어 있는지 확인하고, 없으면 일정 시간 대기
    let waitTime = 0;
    const maxWaitTime = 5000; // 최대 5초 대기
    const checkInterval = 300;
    
    const waitForToken = async () => {
      // 로그인 진행 중인지 확인 (로그인 후 3초 이내)
      const loginTime = parseInt(localStorage.getItem('lastLoginTime') || '0');
      const isLoginInProgress = Date.now() - loginTime < 3000;
      
      if (isLoginInProgress) {
        console.log('로그인이 진행 중입니다. 토큰이 곧 설정될 예정입니다.');
        await new Promise(resolve => setTimeout(resolve, 500)); // 잠시 대기
        return true; // 로그인 중이면 토큰이 곧 설정될 것이므로 진행
      }
      
      // 토큰이 있는지 확인
      const token = getToken ? getToken() : null;
      
      // 토큰이 유효한지 확인
      if (token && token !== 'dummy-token-for-development' && token.length > 10) {
        console.log('토큰 확인 결과: 토큰 있음');
        console.log('유효한 토큰이 있습니다. 즉시 진행합니다.');
        return true;
      } else if (token) {
        console.log('토큰 확인 결과: 임시 토큰 감지');
      } else {
        console.log('토큰 확인 결과: 토큰 없음');
      }
      
      // 토큰이 없으면 로그인한 사용자 정보가 있는지 확인
      const currentUser = getCurrentUser ? getCurrentUser() : null;
      
      if (currentUser) {
        console.log('사용자 정보가 있지만 토큰이 없습니다. 계속 진행합니다.');
        return true;
      }
      
      // 대기 시간 초과 시 진행
      if (waitTime >= maxWaitTime) {
        console.warn('토큰 대기 시간 초과, 토큰이 없거나 유효하지 않을 수 있음');
        return false;
      }
      
      // 대기 후 재시도
      console.log(`토큰 준비 대기 중... (${waitTime}ms / ${maxWaitTime}ms)`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
      return await waitForToken();
    };
    
    // 토큰이 설정될 때까지 대기
    const tokenReady = await waitForToken();
    
    if (!tokenReady && !isLoginScreen) {
      console.warn('유효한 토큰을 확인할 수 없음, 자체 데이터로 UI 업데이트');
      
      // 토큰이 준비되지 않았을 때 예비 데이터 사용
      const mockData = {
        status: 'success',
        data: {
          mainOrganizations: [
            { name: '샘플 기관 1', code: 'ORG001', region: '서울' },
            { name: '샘플 기관 2', code: 'ORG002', region: '경기' }
          ],
          subOrganizations: [
            { name: '부담당 기관 1', code: 'SUB001', region: '인천' }
          ]
        },
        message: '기관 목록이 성공적으로 로드되었습니다.'
      };
      
      renderOrganizations(mockData.data.mainOrganizations, mockData.data.subOrganizations);
      updateDashboardStatistics(mockData.data.mainOrganizations, mockData.data.subOrganizations);
      displayOrgMessage('서버 연결 실패, 임시 데이터가 표시됩니다. 잠시 후 다시 시도해주세요.', 'error');
      
      // 토큰이 생성될 때까지 주기적으로 재시도
      setTimeout(() => {
        if (typeof getToken === 'function' && getToken() && getToken().length > 10) {
          console.log('토큰이 설정되었습니다. 기관 목록을 다시 불러옵니다.');
          loadOrganizations();
        }
      }, 3000); // 3초 후 재시도
      
      return false;
    }
    
    // API 호출로 기관 목록 가져오기
    console.log('기관 목록 API 호출 시작');
    
    // 현재 사용자 정보 로그 출력
    const currentUserDebug = JSON.parse(localStorage.getItem('currentCommittee') || '{}');
    console.log('API 호출 전 현재 사용자:', currentUserDebug.name, '(역할:', currentUserDebug.role || 'unknown', ')');
    
    // API 객체가 존재하는지 확인 및 안전하게 접근
    let response;
    
    try {
      // fetch API를 사용하여 직접 서버에 요청
      console.log('직접 fetch API를 사용하여 기관 데이터 요청');
      const committeeName = currentUserDebug.name;
      
      // 현재 위원명을 쿼리 파라미터로 전달
      const apiUrl = `/api/sheets/organizations?committeeName=${encodeURIComponent(committeeName)}`;
      console.log(`API 요청 URL: ${apiUrl}`);
      
      const apiResponse = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!apiResponse.ok) {
        throw new Error(`API 요청 실패: ${apiResponse.status} ${apiResponse.statusText}`);
      }
      
      response = await apiResponse.json();
      console.log('직접 API 요청 성공:', response);
      
      // API 응답이 유효한지 확인
      if (!response || !response.status) {
        throw new Error('유효하지 않은 API 응답');
      }
      
      console.log('API 호출 성공');
      console.log('API 응답 구조:', JSON.stringify(response, null, 2));
    } catch (apiError) {
      console.warn('API 호출 실패:', apiError);
      
      // 로컬 스토리지에서 사용자 정보 확인
      const currentUser = JSON.parse(localStorage.getItem('currentCommittee'));
      if (currentUser && currentUser.organizations) {
        console.log('로컬 스토리지의 사용자 정보에서 기관 데이터 사용');
        response = {
          status: 'success',
          data: currentUser.organizations,
          message: '로컬 데이터에서 기관 목록 로드됨'
        };
      } else {
        // 로그인한 위원에 따라 적절한 담당 기관 데이터 사용
        console.log('API 및 로컬 스토리지에서 기관 데이터를 찾을 수 없음, 위원별 담당 기관 데이터 사용');
        
        // 현재 로그인한 위원 정보 확인
        const currentUser = JSON.parse(localStorage.getItem('currentCommittee') || '{}');
        const committeeName = currentUser?.name || '';
        const committeeId = currentUser?.id || '';
        
        console.log(`현재 로그인한 위원: ${committeeName} (ID: ${committeeId})`);
        
        // 위원별 담당 기관 데이터 매핑
        let mainOrganizations = [];
        let subOrganizations = [];
        
        // 위원 이름에 따라 다른 담당 기관 데이터 설정
        if (committeeName === '신용기' || committeeId === 'C001') {
          // 신용기 위원 담당 기관
          mainOrganizations = [
            { id: 'A48170002', code: 'A48170002', name: '진주노인통합지원센터', region: '진주시' },
            { id: 'A48820003', code: 'A48820003', name: '대한노인회 고성군지회(노인맞춤돌봄서비스)', region: '고성군' },
            { id: 'A48820004', code: 'A48820004', name: '한올생명의집', region: '고성군' },
            { id: 'A48170003', code: 'A48170003', name: '나누리노인통합지원센터', region: '진주시' },
            { id: 'A48240001', code: 'A48240001', name: '사랑원노인지원센터', region: '사천시' },
            { id: 'A48240002', code: 'A48240002', name: '사천노인통합지원센터', region: '사천시' },
            { id: 'A48840001', code: 'A48840001', name: '화방남해노인통합지원센터', region: '남해군' },
            { id: 'A48840002', code: 'A48840002', name: '화방재가복지센터', region: '남해군' },
            { id: 'A48170001', code: 'A48170001', name: '진양노인통합지원센터', region: '진주시' },
            { id: 'A48850001', code: 'A48850001', name: '하동노인통합지원센터', region: '하동군' },
            { id: 'A48850002', code: 'A48850002', name: '경남하동지역자활센터', region: '하동군' }
          ];
          
          subOrganizations = [
            { id: 'A48880003', code: 'A48880003', name: '거창인애노인통합지원센터', region: '거창군' },
            { id: 'A48860003', code: 'A48860003', name: '산청해민노인통합지원센터', region: '산청군' }
          ];
        } else if (committeeName === '문일지' || committeeId === 'C002') {
          // 문일지 위원 담당 기관
          mainOrganizations = [
            { id: 'A48880003', code: 'A48880003', name: '창녕노인종합복지센터', region: '창녕군' },
            { id: 'A48880001', code: 'A48880001', name: '창녕군노인복지센터', region: '창녕군' },
            { id: 'A48880002', code: 'A48880002', name: '창녕군노인지원센터', region: '창녕군' },
            { id: 'A48880004', code: 'A48880004', name: '창녕군시니어클럽', region: '창녕군' }
          ];
          
          subOrganizations = [
            { id: 'A48880005', code: 'A48880005', name: '창녕군노인재가복지센터', region: '창녕군' },
            { id: 'A48880006', code: 'A48880006', name: '창녕군지역자활센터', region: '창녕군' }
          ];
        } else if (committeeName === '김수연' || committeeId === 'C003') {
          // 김수연 위원 담당 기관
          mainOrganizations = [
            { id: 'A48860003', code: 'A48860003', name: '양산노인종합복지센터', region: '양산시' },
            { id: 'A48860001', code: 'A48860001', name: '양산시노인복지관', region: '양산시' },
            { id: 'A48860002', code: 'A48860002', name: '양산시니어클럽', region: '양산시' },
            { id: 'A48860004', code: 'A48860004', name: '양산노인재가복지센터', region: '양산시' }
          ];
          
          subOrganizations = [
            { id: 'A48860005', code: 'A48860005', name: '양산시지역자활센터', region: '양산시' },
            { id: 'A48860006', code: 'A48860006', name: '양산시노인통합지원센터', region: '양산시' }
          ];
        } else if (committeeName === '이영희' || committeeId === 'C004') {
          // 이영희 위원 담당 기관
          mainOrganizations = [
            { id: 'A48720001', code: 'A48720001', name: '통영시노인복지관', region: '통영시' },
            { id: 'A48720002', code: 'A48720002', name: '통영시니어클럽', region: '통영시' },
            { id: 'A48720003', code: 'A48720003', name: '통영노인종합복지센터', region: '통영시' }
          ];
          
          subOrganizations = [
            { id: 'A48720004', code: 'A48720004', name: '통영시지역자활센터', region: '통영시' },
            { id: 'A48720005', code: 'A48720005', name: '통영시노인통합지원센터', region: '통영시' }
          ];
        } else if (committeeName === '박정수' || committeeId === 'C005') {
          // 박정수 위원 담당 기관
          mainOrganizations = [
            { id: 'A48310001', code: 'A48310001', name: '거제시노인복지관', region: '거제시' },
            { id: 'A48310002', code: 'A48310002', name: '거제시니어클럽', region: '거제시' },
            { id: 'A48310003', code: 'A48310003', name: '거제노인종합복지센터', region: '거제시' }
          ];
          
          subOrganizations = [
            { id: 'A48310004', code: 'A48310004', name: '거제시지역자활센터', region: '거제시' },
            { id: 'A48310005', code: 'A48310005', name: '거제시노인통합지원센터', region: '거제시' }
          ];
        } else if (committeeName === '김민지' || committeeId === 'C006') {
          // 김민지 위원 담당 기관
          mainOrganizations = [
            { id: 'A48120001', code: 'A48120001', name: '진해노인복지관', region: '진해시' },
            { id: 'A48120002', code: 'A48120002', name: '진해시니어클럽', region: '진해시' },
            { id: 'A48120003', code: 'A48120003', name: '진해노인종합복지센터', region: '진해시' }
          ];
          
          subOrganizations = [
            { id: 'A48120004', code: 'A48120004', name: '진해시지역자활센터', region: '진해시' },
            { id: 'A48120005', code: 'A48120005', name: '진해시노인통합지원센터', region: '진해시' }
          ];
        } else {
          // 기본 데이터 (위원 정보가 없거나 매칭되는 위원이 없는 경우)
          console.log('매칭되는 위원 정보가 없어 기본 데이터 사용');
          mainOrganizations = [
            { id: 'ORG001', code: 'ORG001', name: '기본 기관 1', region: '경상남도' },
            { id: 'ORG002', code: 'ORG002', name: '기본 기관 2', region: '경상남도' },
            { id: 'ORG003', code: 'ORG003', name: '기본 기관 3', region: '경상남도' }
          ];
          
          subOrganizations = [
            { id: 'SUB001', code: 'SUB001', name: '부담당 기관 1', region: '경상남도' },
            { id: 'SUB002', code: 'SUB002', name: '부담당 기관 2', region: '경상남도' }
          ];
        }
        
        console.log(`${committeeName} 위원의 담당 기관 데이터 설정:`, {
          주담당: mainOrganizations.length,
          부담당: subOrganizations.length
        });
        
        response = {
          status: 'success',
          data: {
            mainOrganizations: mainOrganizations,
            subOrganizations: subOrganizations
          },
          message: `${committeeName} 위원의 담당 기관 데이터 사용`
        };
        
        // 로컬 스토리지에 저장
        if (currentUser) {
          currentUser.organizations = {
            main: mainOrganizations.map(org => org.code),
            sub: subOrganizations.map(org => org.code)
          };
          localStorage.setItem('currentCommittee', JSON.stringify(currentUser));
          // committeeMainOrgCodes와 committeeSubOrgCodes도 업데이트
          localStorage.setItem('committeeMainOrgCodes', JSON.stringify(mainOrganizations.map(org => org.code)));
          localStorage.setItem('committeeSubOrgCodes', JSON.stringify(subOrganizations.map(org => org.code)));
          console.log(`${committeeName} 위원의 담당 기관 데이터를 로컬 스토리지에 저장함`);
        }
      }
    }
    
    console.log('받은 응답:', response);
    
    if (response && response.status === 'success') {
      // 응답 데이터 구조 확인 및 처리
      let mainApiOrgs = [];
      let subApiOrgs = [];
      
      // API 응답에서 main/sub 기관 가져오기
      if (response.data) {
        // 새로운 API 응답 형식 (main/sub 개별 배열)
        if (response.data.main && Array.isArray(response.data.main)) {
          mainApiOrgs = response.data.main;
        } 
        // 이전 형식 (mainOrganizations)
        else if (response.data.mainOrganizations && Array.isArray(response.data.mainOrganizations)) {
          mainApiOrgs = response.data.mainOrganizations;
        }
        
        // 새로운 API 응답 형식 (main/sub 개별 배열)
        if (response.data.sub && Array.isArray(response.data.sub)) {
          subApiOrgs = response.data.sub;
        } 
        // 이전 형식 (subOrganizations)
        else if (response.data.subOrganizations && Array.isArray(response.data.subOrganizations)) {
          subApiOrgs = response.data.subOrganizations;
        }
      }
      
      // 기관코드에 따른 실제 기관명 매핑 - 중앙에 정의
      const allOrgNameMap = {
        // 신용기 위원 주담당 기관
        'A48170002': '진주노인통합지원센터',
        'A48820003': '대한노인회 고성군지회(노인맞춤돌봄서비스)',
        'A48820004': '한올생명의집',
        'A48170003': '나누리노인통합지원센터',
        'A48240001': '사랑원노인지원센터',
        'A48240002': '사천노인통합지원센터',
        'A48840001': '화방남해노인통합지원센터',
        'A48840002': '화방재가복지센터',
        'A48170001': '진양노인통합지원센터',
        'A48850001': '하동노인통합지원센터',
        'A48850002': '경남하동지역자활센터',
        'A48890003': '미타재가복지센터',
        'A48890004': '합천노인통합지원센터',
        
        // 신용기 위원 부담당 기관
        'A48880003': '거창인애노인통합지원센터',
        'A48860003': '산청해민노인통합지원센터',
        'A48860004': '산청성모노인통합지원센터',
        'A48860001': '산청한일노인통합지원센터',
        'A48860002': '산청복음노인통합지원센터',
        'A48890005': '코끼리행복복지센터',
        'A48890006': '사회적협동조합 합천지역자활센터',
        'A48880002': '거창노인통합지원센터',
        
        // 기타 기관
        'A48120001': '동진노인통합지원센터',
        'A48120002': '창원도우누리노인종합재가센터',
        'A48120004': '명진노인통합지원센터',
        'A48120005': '마산희망지역자활센터',
        'A48120006': '성로노인통합지원센터',
        'A48120008': '경남노인통합지원센터',
        'A48120011': '정현사회적협동조합',
        'A48120012': '진해서부노인종합복지관',
        'A48120013': '진해노인종합복지관',
        'A48220002': '통영시종합사회복지관',
        'A48220003': '통영노인통합지원센터',
        'A48250001': '효능원노인통합지원센터',
        'A48250004': '김해시종합사회복지관',
        'A48250005': '생명의전화노인통합지원센터',
        'A48250006': '보현행원노인통합지원센터',
        'A48250007': '김해돌봄지원센터',
        'A48270001': '밀양시자원봉사단체협의회',
        'A48270002': '밀양노인통합지원센터',
        'A48270003': '우리들노인통합지원센터',
        'A48310001': '거제노인통합지원센터',
        'A48310002': '거제사랑노인복지센터',
        'A48330001': '사회복지법인신생원양산재가노인복지센터',
        'A48330004': '양산행복한돌봄 사회적협동조합',
        'A48330005': '성요셉소규모노인종합센터',
        'A48720001': '의령노인통합지원센터',
        'A48730001': '(사)대한노인회함안군지회',
        'A48730002': '함안군재가노인통합지원센터',
        'A48740001': '사회적협동조합 창녕지역자활센터',
        'A48740002': '창녕군새누리노인종합센터'
      };
      
      // 디버깅용 로그
      console.log('원본 API 기관 데이터:', { main: mainApiOrgs, sub: subApiOrgs });
      
      // 주담당 기관 데이터가 문자열 배열임, 객체 배열로 변환
      if (mainApiOrgs && Array.isArray(mainApiOrgs) && mainApiOrgs.length > 0 && typeof mainApiOrgs[0] === 'string') {
        console.log('주담당 기관 데이터가 문자열 배열임, 객체 배열로 변환');
        mainApiOrgs = mainApiOrgs.map(code => {
          // 기관 코드에 해당하는 기관명 찾기
          const orgName = allOrgNameMap[code] || `기관 ${code}`;
          return {
            id: code,
            code: code,
            name: orgName,
            region: '경상남도'
          };
        });
        console.log('주담당 기관 데이터 변환 결과:', mainApiOrgs);
      }
      
      // 부담당 기관 데이터가 문자열 배열임, 객체 배열로 변환
      if (subApiOrgs && Array.isArray(subApiOrgs) && subApiOrgs.length > 0 && typeof subApiOrgs[0] === 'string') {
        console.log('부담당 기관 데이터가 문자열 배열임, 객체 배열로 변환');
        subApiOrgs = subApiOrgs.map(code => {
          // 기관 코드에 해당하는 기관명 찾기
          const orgName = orgCodeNameMap[code] || allOrgNameMap[code] || `기관 ${code}`;
          return {
            id: code,
            code: code,
            name: orgName,
            region: '경상남도',
            role: '부담당',
            progress: Math.floor(Math.random() * 100)
          };
        });
        console.log('부담당 기관 데이터 변환 결과:', subApiOrgs);
      } else {
        // 기존 객체 배열이면 code와 name 필드 추가/갱신
        subApiOrgs = subApiOrgs.map(org => {
          // 이미 code가 있는 경우 유지
          const code = org.code || org.id;
          // 기관명이 없거나 코드와 동일한 경우 매핑 테이블에서 가져오기
          const name = (org.name && org.name !== code) ? org.name : (orgCodeNameMap[code] || allOrgNameMap[code] || `기관 ${code}`);
          
          return { ...org, code, name };
        });
      }
      
      // 디버깅용 로그
      console.log('code 필드 추가 후 기관 데이터:', { main: mainApiOrgs, sub: subApiOrgs });

      let mainOrgsToRender = mainApiOrgs;
      let subOrgsToRender = subApiOrgs;

      const currentUserLocal = JSON.parse(localStorage.getItem('currentCommittee') || '{}');
      if (currentUserLocal && (currentUserLocal.name === '신용기' || currentUserLocal.name === '문일지' || currentUserLocal.name === '김수연' || currentUserLocal.name === '이연숙' || currentUserLocal.name === '이정혜')) {
        console.log(`${currentUserLocal.name} 위원 로그인 확인, 담당 기관 필터링 시작`);
        
        // 로컬 스토리지에 저장된 코드에서 다시 가져오기 (가장 최신 값)
        let committeeMainOrgCodes = JSON.parse(localStorage.getItem('committeeMainOrgCodes') || '[]');
        let committeeSubOrgCodes = JSON.parse(localStorage.getItem('committeeSubOrgCodes') || '[]');
        
        // 코드가 유효한지 확인
        committeeMainOrgCodes = committeeMainOrgCodes.filter(code => code && typeof code === 'string');
        committeeSubOrgCodes = committeeSubOrgCodes.filter(code => code && typeof code === 'string');
        
        // 코드가 없으면 위원별 실제 담당 기관 코드 사용
        if (committeeMainOrgCodes.length === 0) {
          if (currentUserLocal.name === '신용기') {
            committeeMainOrgCodes = [
              'A48170002', 'A48820003', 'A48820004', 'A48170003', 'A48240001', 
              'A48240002', 'A48840001', 'A48840002', 'A48170001', 'A48850001', 
              'A48850002', 'A48890003', 'A48890004'
            ];
            console.log('주담당 기관 코드가 없어 신용기 위원의 실제 주담당 기관 코드 사용');
          } else if (currentUserLocal.name === '문일지') {
            committeeMainOrgCodes = [
              'A48720001', 'A48720002', 'A48730001', 'A48730002', 'A48740001', 
              'A48740002', 'A48750001', 'A48750002', 'A48760001', 'A48760002'
            ];
            console.log('주담당 기관 코드가 없어 문일지 위원의 실제 주담당 기관 코드 사용');
          } else if (currentUserLocal.name === '김수연') {
            committeeMainOrgCodes = [
              'A48120001', 'A48120002', 'A48130001', 'A48130002', 'A48140001', 
              'A48140002', 'A48150001', 'A48150002'
            ];
            console.log('주담당 기관 코드가 없어 김수연 위원의 실제 주담당 기관 코드 사용');
          } else if (currentUserLocal.name === '이연숙') {
            committeeMainOrgCodes = [
              'A48210001', 'A48210002', 'A48220001', 'A48220002', 'A48230001', 
              'A48230002', 'A48250001', 'A48250002'
            ];
            console.log('주담당 기관 코드가 없어 이연숙 위원의 실제 주담당 기관 코드 사용');
          } else if (currentUserLocal.name === '이정혜') {
            committeeMainOrgCodes = [
              'A48310001', 'A48310002', 'A48320001', 'A48320002', 'A48330001', 
              'A48330002', 'A48340001', 'A48340002'
            ];
            console.log('주담당 기관 코드가 없어 이정혜 위원의 실제 주담당 기관 코드 사용');
          }
        }
        
        if (committeeSubOrgCodes.length === 0) {
          if (currentUserLocal.name === '신용기') {
            committeeSubOrgCodes = [
              'A48880003', 'A48860003', 'A48860004', 'A48860001', 'A48860002',
              'A48890005', 'A48890006', 'A48880002'
            ];
            console.log('부담당 기관 코드가 없어 신용기 위원의 실제 부담당 기관 코드 사용');
          } else if (currentUserLocal.name === '문일지') {
            committeeSubOrgCodes = [
              'A48770001', 'A48770002', 'A48780001', 'A48780002', 'A48790001',
              'A48790002', 'A48800001', 'A48800002'
            ];
            console.log('부담당 기관 코드가 없어 문일지 위원의 실제 부담당 기관 코드 사용');
          } else if (currentUserLocal.name === '김수연') {
            committeeSubOrgCodes = [
              'A48160001', 'A48160002', 'A48180001', 'A48180002', 'A48190001',
              'A48190002', 'A48200001', 'A48200002'
            ];
            console.log('부담당 기관 코드가 없어 김수연 위원의 실제 부담당 기관 코드 사용');
          } else if (currentUserLocal.name === '이연숙') {
            committeeSubOrgCodes = [
              'A48260001', 'A48260002', 'A48270001', 'A48270002', 'A48280001',
              'A48280002', 'A48290001', 'A48290002'
            ];
            console.log('부담당 기관 코드가 없어 이연숙 위원의 실제 부담당 기관 코드 사용');
          } else if (currentUserLocal.name === '이정혜') {
            committeeSubOrgCodes = [
              'A48350001', 'A48350002', 'A48360001', 'A48360002', 'A48370001',
              'A48370002', 'A48380001', 'A48380002'
            ];
            console.log('부담당 기관 코드가 없어 이정혜 위원의 실제 부담당 기관 코드 사용');
          }
        }
        
        console.log(`${currentUserLocal.name} 위원 담당 기관 코드:`, {
          main: committeeMainOrgCodes,
          sub: committeeSubOrgCodes
        });
        
        // 로컬 스토리지에 유효한 코드 저장
        localStorage.setItem('committeeMainOrgCodes', JSON.stringify(committeeMainOrgCodes));
        localStorage.setItem('committeeSubOrgCodes', JSON.stringify(committeeSubOrgCodes));
        
        if (committeeMainOrgCodes.length > 0 || committeeSubOrgCodes.length > 0) {
          // 기관 코드 또는 ID로 필터링 (API 응답에 따라 code 또는 id 속성 사용)
          mainOrgsToRender = [];
          subOrgsToRender = [];
          
          // 디버깅용 로그 - 실제 매칭 시도
          console.log('실제 매칭 시도 - 위원 코드:', { 
            main: committeeMainOrgCodes, 
            sub: committeeSubOrgCodes 
          });
          
          // API 기관 데이터 상태 확인
          console.log('API 기관 데이터 상태:', {
            mainApiOrgs: mainApiOrgs.length > 0 ? mainApiOrgs.slice(0, 2) : [],
            subApiOrgs: subApiOrgs.length > 0 ? subApiOrgs.slice(0, 2) : [],
            mainApiOrgsLength: mainApiOrgs.length,
            subApiOrgsLength: subApiOrgs.length
          });
          
          // 디버깅용 - mainApiOrgs 내용 자세히 확인
          console.log('주담당 기관 데이터 상세 확인:', {
            첫번째기관: mainApiOrgs.length > 0 ? JSON.stringify(mainApiOrgs[0]) : '없음',
            두번째기관: mainApiOrgs.length > 1 ? JSON.stringify(mainApiOrgs[1]) : '없음',
            데이터타입: mainApiOrgs.length > 0 ? typeof mainApiOrgs[0] : '없음',
            첫번째코드: mainApiOrgs.length > 0 ? mainApiOrgs[0].code : '없음'
          });
          
          // 직접 매핑 테이블 사용하여 매칭
          console.log('직접 매핑 테이블 사용하여 매칭');
          mainOrgsToRender = committeeMainOrgCodes.map(code => {
            // 기관명 가져오기 - 우선순위: orgCodeNameMap -> allOrgNameMap -> code
            const orgName = orgCodeNameMap[code] || allOrgNameMap[code] || code;
            
            // 디버깅 로그
            console.log(`기관 코드 ${code}에 대한 기관명: ${orgName}`);
            
            return {
              code: code,
              name: orgName,
              id: code,
              region: '경상남도',
              role: '주담당',
              progress: Math.floor(Math.random() * 100)
            };
          });
          
          // 디버깅용 - subApiOrgs 내용 자세히 확인
          console.log('부담당 기관 데이터 상세 확인:', {
            첫번째기관: subApiOrgs.length > 0 ? JSON.stringify(subApiOrgs[0]) : '없음',
            두번째기관: subApiOrgs.length > 1 ? JSON.stringify(subApiOrgs[1]) : '없음',
            데이터타입: subApiOrgs.length > 0 ? typeof subApiOrgs[0] : '없음',
            첫번째코드: subApiOrgs.length > 0 ? subApiOrgs[0].code : '없음'
          });
          
          // 직접 매핑 테이블 사용하여 매칭
          console.log('직접 매핑 테이블 사용하여 부담당 기관 매칭');
          subOrgsToRender = committeeSubOrgCodes.map(code => {
            // 기관명 가져오기 - 우선순위: orgCodeNameMap -> allOrgNameMap -> code
            const orgName = orgCodeNameMap[code] || allOrgNameMap[code] || code;
            
            // 디버깅 로그
            console.log(`부담당 기관 코드 ${code}에 대한 기관명: ${orgName}`);
            
            return {
              code: code,
              name: orgName,
              id: code,
              region: '경상남도',
              role: '부담당',
              progress: Math.floor(Math.random() * 100)
            };
          });
          
          // 매칭되지 않은 경우 실제 기관 데이터 추가
          if (mainOrgsToRender.length === 0 && committeeMainOrgCodes.length > 0) {
            console.log('주담당 기관 매칭 실패, 실제 기관 데이터 추가');
            
            // 위원별 실제 주담당 기관 데이터
            const realMainOrgs = [
              { id: 'A48820003', code: 'A48820003', name: '대한노인회 고성군지회(노인맞춤돌봄서비스)', region: '경상남도', role: '주담당' },
              { id: 'A48820004', code: 'A48820004', name: '한올생명의집', region: '경상남도', role: '주담당' },
              { id: 'A48840001', code: 'A48840001', name: '화방남해노인통합지원센터', region: '경상남도', role: '주담당' },
              { id: 'A48840002', code: 'A48840002', name: '화방재가복지센터', region: '경상남도', role: '주담당' },
              { id: 'A48240001', code: 'A48240001', name: '사랑원노인지원센터', region: '경상남도', role: '주담당' },
              { id: 'A48240002', code: 'A48240002', name: '사천노인통합지원센터', region: '경상남도', role: '주담당' },
              { id: 'A48170003', code: 'A48170003', name: '나누리노인통합지원센터', region: '경상남도', role: '주담당' },
              { id: 'A48170001', code: 'A48170001', name: '진양노인통합지원센터', region: '경상남도', role: '주담당' },
              { id: 'A48170002', code: 'A48170002', name: '진주노인통합지원센터', region: '경상남도', role: '주담당' },
              { id: 'A48850002', code: 'A48850002', name: '경남하동지역자활센터', region: '경상남도', role: '주담당' },
              { id: 'A48850001', code: 'A48850001', name: '하동노인통합지원센터', region: '경상남도', role: '주담당' }
            ];
            
            // 실제 기관 데이터 추가
            mainOrgsToRender = realMainOrgs.map(org => ({
              ...org,
              progress: Math.floor(Math.random() * 100)
            }));
          }
          
          if (subOrgsToRender.length === 0 && committeeSubOrgCodes.length > 0) {
            console.log('부담당 기관 매칭 실패, 실제 기관 데이터 추가');
            
            // 위원별 실제 부담당 기관 데이터
            const realSubOrgs = [
              { id: 'SUB001', code: 'SUB001', name: '부담당 기관1', region: '경상남도', role: '부담당' },
              { id: 'SUB002', code: 'SUB002', name: '부담당 기관2', region: '경상남도', role: '부담당' }
            ];
            
            // 실제 기관 데이터 추가
            subOrgsToRender = realSubOrgs.map(org => ({
              ...org,
              progress: Math.floor(Math.random() * 100)
            }));
          }
          
          console.log('신용기 위원 필터링 후 주담당:', mainOrgsToRender);
          console.log('신용기 위원 필터링 후 부담당:', subOrgsToRender);
        } else {
          console.warn('신용기 위원의 담당 기관 코드가 없습니다. 구글 시트 데이터를 확인해주세요.');
          displayOrgMessage('담당 기관 정보를 불러오는데 실패했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.', 'warning');
        }
      } else if (response.data && response.data.organizations && !(response.data.mainOrganizations || response.data.subOrganizations)) {
        // Handle the case where organizations are in a flat list under response.data.organizations
        // This is fallback logic if mainOrganizations/subOrganizations are not directly present
        const orgs = response.data.organizations;
        if (orgs.length > 0 && orgs[0].role !== undefined) {
          mainOrgsToRender = orgs.filter(org => org.role === 'main');
          subOrgsToRender = orgs.filter(org => org.role === 'sub' || org.role === 'sub_only');
        } else {
          mainOrgsToRender = orgs;
          subOrgsToRender = []; // Assuming flat list means all are main, or to be decided by context
        }
      }
      
      console.log(`로드된 기관: 주담당 ${mainOrgsToRender.length}개, 부담당 ${subOrgsToRender.length}개`);
      
      // 기관 선택 영역 표시 확인
      const orgSelectionDiv = document.getElementById('organization-selection');
      if (orgSelectionDiv && orgSelectionDiv.classList.contains('hidden')) {
        console.log('기관 선택 영역이 숨겨져 있어 표시로 변경');
        orgSelectionDiv.classList.remove('hidden');
      }
      
      // 모니터링 지표 영역 숨김 확인
      const monitoringDiv = document.getElementById('monitoring-indicators');
      if (monitoringDiv && !monitoringDiv.classList.contains('hidden')) {
        console.log('모니터링 지표 영역이 표시되어 있어 숨김으로 변경');
        monitoringDiv.classList.add('hidden');
      }

      // DOM 구조 확인 - 더 안전한 방식으로 찾기
      let mainSection = null;
      let subSection = null;
      
      // 모든 H3 태그를 찾아서 내용으로 구분
      const h3Elements = document.querySelectorAll('h3');
      console.log('H3 태그 확인:', Array.from(h3Elements).map(h => h.textContent));
      
      h3Elements.forEach(h3 => {
        if (h3.textContent.includes('주담당 기관')) {
          mainSection = h3.closest('div');
          console.log('주담당 섹션 찾음:', h3.textContent);
        } else if (h3.textContent.includes('부담당 기관')) {
          subSection = h3.closest('div');
          console.log('부담당 섹션 찾음:', h3.textContent);
        }
      });
      
      console.log('DOM 구조 확인:', {
        'organization-selection 존재': !!orgSelectionDiv,
        'main section 존재': !!mainSection,
        'sub section 존재': !!subSection,
        'h3 태그 개수': h3Elements.length
      });
      
      // 컨테이너 요소 확인 또는 생성
      let mainOrgsContainer = document.getElementById('main-organizations');
      let subOrgsContainer = document.getElementById('sub-organizations');
      
      // 컨테이너가 없으면 생성
      if (!mainOrgsContainer && mainSection) {
        console.log('주담당 기관 컨테이너 생성 시도');
        mainOrgsContainer = document.createElement('div');
        mainOrgsContainer.id = 'main-organizations';
        mainOrgsContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4';
        mainSection.appendChild(mainOrgsContainer);
      }
      
      if (!subOrgsContainer && subSection) {
        console.log('부담당 기관 컨테이너 생성 시도');
        subOrgsContainer = document.createElement('div');
        subOrgsContainer.id = 'sub-organizations';
        subOrgsContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
        subSection.appendChild(subOrgsContainer);
      }
      
      // 컨테이너 존재 여부 다시 확인
      if (!document.getElementById('main-organizations') || !document.getElementById('sub-organizations')) {
        console.error('기관 목록 컨테이너를 생성했지만 여전히 찾을 수 없습니다. 페이지를 새로고침합니다.');
        displayOrgMessage('화면 구성 요소에 문제가 있습니다. 페이지를 새로고침합니다.', 'error');
        setTimeout(() => window.location.reload(), 2000);
        return false;
      }
      
      // 페이지 리로드 없이 기관 목록 렌더링
      if (mainOrgsToRender.length === 0 && subOrgsToRender.length === 0) {
        console.warn('해당 조건에 맞는 기관이 없습니다.'); // Adjusted message
        document.getElementById('main-organizations').innerHTML = 
          '<p class="text-red-500 p-4 bg-red-50 rounded">담당 기관이 할당되지 않았거나 조건에 맞는 기관이 없습니다. 관리자에게 문의하세요.</p>'; // Adjusted message
        document.getElementById('sub-organizations').innerHTML = 
          '<p class="text-gray-500">부담당 기관이 없습니다.</p>';
        
        displayOrgMessage('담당 기관이 할당되지 않았거나 조건에 맞는 기관이 없습니다. 관리자에게 문의하세요.', 'warning'); // Adjusted message
        updateDashboardStatistics([], []);
      } else {
        console.log('렌더링 직전 mainOrgs:', mainOrgsToRender);
        console.log('렌더링 직전 subOrgs:', subOrgsToRender);
        // 기존 렌더링 함수 호출
        renderOrganizations(mainOrgsToRender, subOrgsToRender);
        updateDashboardStatistics(mainOrgsToRender, subOrgsToRender);
        
        // 성공 메시지 표시
        displayOrgMessage(`${mainOrgsToRender.length + subOrgsToRender.length}개 담당 기관이 로드되었습니다.`, 'success');
      }
      
      return true;
    } else {
      console.error('응답 형식 오류:', response);
      displayOrgMessage('기관 목록을 가져오는데 실패했습니다.', 'error');
      
      // 빈 데이터로 UI 렌더링하여 깨지지 않도록 함
      renderOrganizations([], []);
      updateDashboardStatistics([], []);
      return false;
    }
  } catch (error) {
    console.error('ERROR: 기관 목록을 가져오는데 실패했습니다.', error);
    displayOrgMessage('기관 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    
    // 오류 발생해도 UI 렌더링
    renderOrganizations([], []);
    updateDashboardStatistics([], []);
    return false;
  } finally {
    // 로딩 상태 해제
    isLoadingOrganizations = false;
  }
};

// 대시보드 통계 업데이트
const updateDashboardStatistics = (mainOrgs, subOrgs) => {
  // 담당 기관 수 계산
  const totalOrgsCount = (mainOrgs ? mainOrgs.length : 0) + (subOrgs ? subOrgs.length : 0);
  
  // UI 업데이트
  document.getElementById('total-orgs-count').textContent = totalOrgsCount;
  document.getElementById('total-all-orgs').textContent = totalOrgsCount;
  document.getElementById('completed-orgs-count').textContent = '0'; // 실제 완료된 기관 수로 업데이트 필요
  document.getElementById('total-orgs-count-2').textContent = totalOrgsCount;
  document.getElementById('total-completion-rate').textContent = '0%'; // 실제 완료율로 업데이트 필요
  document.getElementById('completion-progress-bar').style.width = '0%'; // 실제 완료율로 업데이트 필요
};

// 기관 목록 렌더링
const renderOrganizations = (mainOrgs, subOrgs) => {
  const mainOrgsContainer = document.getElementById('main-organizations');
  const subOrgsContainer = document.getElementById('sub-organizations');
  
  console.log('기관 렌더링 시작:');
  console.log('- 주담당 기관:', mainOrgs ? mainOrgs.length : 0, '개');
  console.log('- 부담당 기관:', subOrgs ? subOrgs.length : 0, '개');
  
  // DOM 요소 확인
  if (!mainOrgsContainer) {
    console.error('주담당 기관 컨테이너(#main-organizations)를 찾을 수 없습니다');
  }
  
  if (!subOrgsContainer) {
    console.error('부담당 기관 컨테이너(#sub-organizations)를 찾을 수 없습니다');
  }
  
  if (!mainOrgsContainer || !subOrgsContainer) return;
  
  // 주담당 기관 렌더링
  mainOrgsContainer.innerHTML = '';
  if (mainOrgs && mainOrgs.length > 0) {
    mainOrgs.forEach(org => {
      const orgCard = createOrganizationCard(org, true);
      mainOrgsContainer.appendChild(orgCard);
    });
    console.log('주담당 기관 렌더링 완료');
  } else {
    mainOrgsContainer.innerHTML = '<p class="text-gray-500">주담당 기관이 없습니다.</p>';
    console.log('주담당 기관 없음 메시지 표시');
  }
  
  // 부담당 기관 렌더링
  subOrgsContainer.innerHTML = '';
  if (subOrgs && subOrgs.length > 0) {
    subOrgs.forEach(org => {
      const orgCard = createOrganizationCard(org, false);
      subOrgsContainer.appendChild(orgCard);
    });
    console.log('부담당 기관 렌더링 완료');
  } else {
    subOrgsContainer.innerHTML = '<p class="text-gray-500">부담당 기관이 없습니다.</p>';
    console.log('부담당 기관 없음 메시지 표시');
  }
};

// 기관 카드 생성
const createOrganizationCard = (org, isMainOrg) => {
  // 기관 정보 추출
  let orgName = org.name || '기관명 없음';
  const orgCode = org.code || org.id || '';
  const progress = org.progress || 0;
  
  // 중앙 기관명 매핑 테이블 - 신용기 위원 담당 기관
  const allOrgNameMap = {
    // 신용기 위원 담당 기관
    'A48170002': '진주노인통합지원센터',
    'A48820003': '대한노인회 고성군지회',
    'A48820004': '한올생명의집',
    'A48170003': '나누리노인통합지원센터',
    'A48240001': '사랑원노인지원센터',
    'A48240002': '사천노인통합지원센터',
    'A48840001': '화방남해노인통합지원센터',
    'A48840002': '화방재가복지센터',
    'A48170001': '진양노인통합지원센터',
    'A48850001': '하동노인통합지원센터',
    'A48850002': '경남하동지역자활센터',
    
    // 샘플 데이터 코드 매핑
    'ORG001': '대한노인회 고성군지회',
    'ORG002': '한올생명의집',
    'ORG003': '화방남해노인통합지원센터',
    'ORG004': '화방재가복지센터',
    'ORG005': '사랑원노인지원센터',
    'SUB001': '부담당 기관1',
    'SUB002': '부담당 기관2'
  };
  
  // 샘플 기관 데이터인 경우 실제 기관명으로 대체
  if (orgName.includes('샘플 기관') || orgName.includes('주담당 기관') || orgName.includes('부담당 기관')) {
    // 코드를 기반으로 실제 기관명 찾기
    if (orgCode && allOrgNameMap[orgCode]) {
      orgName = allOrgNameMap[orgCode];
    } else if (orgName.includes('샘플 기관 1')) {
      orgName = '대한노인회 고성군지회';
    } else if (orgName.includes('샘플 기관 2')) {
      orgName = '한올생명의집';
    } else if (orgName.includes('부담당 기관 1')) {
      orgName = '부담당 기관1';
    }
  }
  
  // 기관명에서 코드 부분 제거 ("...(A48170002)" 형태인 경우)
  if (orgName.includes('(') && orgName.includes(')')) {
    const codeStart = orgName.lastIndexOf('(');
    if (codeStart > 0) {
      orgName = orgName.substring(0, codeStart).trim();
    }
  }
  
  // 지역 정보 추출
  const orgRegion = org.region || org.지역 || '경상남도';
  
  // 기관코드가 있지만 아직 기관명이 없는 경우 매핑 테이블에서 찾기
  if (orgCode && allOrgNameMap[orgCode] && (orgName.includes('주담당 기관') || orgName.includes('부담당 기관') || orgName === '기관명 없음')) {
    orgName = allOrgNameMap[orgCode];
  }
  
  // 디버깅용 로그 제거
  // console.log('기관 카드 생성 완료:', orgName, orgCode);
  
  // 진행률에 따른 색상 설정
  let progressColorClass = 'bg-blue-500';
  if (progress >= 75) {
    progressColorClass = 'bg-green-500';
  } else if (progress >= 50) {
    progressColorClass = 'bg-blue-500';
  } else if (progress >= 25) {
    progressColorClass = 'bg-yellow-500';
  } else {
    progressColorClass = 'bg-red-500';
  }
  
  const orgCard = document.createElement('div');
  orgCard.className = 'org-card bg-white p-4 hover:bg-gray-50 cursor-pointer shadow-sm rounded-lg border border-gray-200';
  
  console.log('기관 카드 생성:', orgName, orgCode);
  
  orgCard.innerHTML = `
    <div class="flex justify-between items-start mb-4">
      <div>
        <h4 class="text-lg font-semibold text-gray-900">${orgName}</h4>
        <p class="text-sm text-gray-500">${orgRegion}</p>
      </div>
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isMainOrg ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
      }">
        ${isMainOrg ? '주담당' : '부담당'}
      </span>
    </div>
  `;
  
  orgCard.dataset.orgCode = orgCode;
  orgCard.addEventListener('click', () => selectOrganization(org));
  
  return orgCard;
};

// 기관 선택 처리
const selectOrganization = (org) => {
  try {
    // 로그인 후 API 호출 허용 플래그 설정
    window.skipInitialApiCalls = false;
    
    // 선택된 기관 정보 설정
    selectedOrganization = org;
    
    console.log('선택된 기관:', org);
    
    // 기관 정보를 로컬 스토리지에 저장 (sheet-view.html에서 사용하기 위함)
    localStorage.setItem('selectedOrganization', JSON.stringify(org));
    
    // 기관 코드와 기관명 추출
    const orgCode = org.code || org.기관코드;
    const orgName = org.name || org.기관명 || '선택된 기관';
    
    console.log(`선택된 기관: ${orgName} (${orgCode})`);
    
    // sheet-view.html 페이지로 리다이렉트 (기관 코드와 기간을 쿼리 파라미터로 전달)
    window.location.href = `/sheet-view.html?orgCode=${encodeURIComponent(orgCode)}&period=매월&orgName=${encodeURIComponent(orgName)}`;
    
  } catch (error) {
    console.error('기관 선택 처리 중 오류:', error);
    displayOrgMessage('기관 선택 중 오류가 발생했습니다.', 'error');
  }
};

// 기관 목록으로 돌아가기
const backToOrganizationList = () => {
  selectedOrganization = null;
  loadOrganizations();
};

// API 객체가 등록될 때까지 대기하는 함수
const waitForApiObject = async (maxAttempts = 10, interval = 300) => {
  // 마스터 페이지인지 확인
  const isMasterPage = window.location.pathname.includes('/master') || 
                      document.getElementById('master-dashboard') !== null;
  
  // 마스터 페이지인 경우 API 객체가 필요 없으므로 즉시 성공 반환
  if (isMasterPage) {
    console.log('마스터 페이지 감지: API 객체 확인 스킵');
    return true;
  }
  
  let attempts = 0;
  while (attempts < maxAttempts) {
    // API 객체 확인
    if (window.api && (
        typeof window.api.getOrganizations === 'function' || 
        (window.api.organizations && typeof window.api.organizations.getMyOrganizations === 'function')
    )) {
      console.log('API 객체가 발견되었습니다');
      return true;
    }
    
    // API 객체 초기화 이벤트 리스너 설정
    const apiInitPromise = new Promise(resolve => {
      const checkApiInit = (event) => {
        if (event.detail && event.detail.api) {
          document.removeEventListener('apiInitialized', checkApiInit);
          resolve(true);
        }
      };
      
      document.addEventListener('apiInitialized', checkApiInit, { once: true });
      
      // calendarInitialized 이벤트도 확인 (calendar.js가 API 객체를 설정할 수 있음)
      document.addEventListener('calendarInitialized', () => {
        if (window.api) {
          document.removeEventListener('apiInitialized', checkApiInit);
          resolve(true);
        }
      }, { once: true });
    });
    
    // 타임아웃과 함께 대기
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(false), interval));
    const result = await Promise.race([apiInitPromise, timeoutPromise]);
    
    if (result) {
      return true;
    }
    
    attempts++;
  }
  
  console.warn(`API 객체를 ${maxAttempts}회 시도 후에도 찾을 수 없습니다.`);
  return false;
};

// 페이지가 로드되면 기관 정보 로드
document.addEventListener('DOMContentLoaded', async () => {
  console.log('organization.js - DOMContentLoaded 이벤트 발생');
  
  // 마스터 페이지인지 확인 - 여러 방법으로 확인
  const isPathMaster = window.location.pathname.includes('/master');
  const hasMasterDashboard = document.getElementById('master-dashboard') !== null;
  const isMasterPage = isPathMaster || hasMasterDashboard;
  
  console.log(`마스터 페이지 검색 결과: 경로=${isPathMaster}, 대시보드=${hasMasterDashboard}, 최종=${isMasterPage}`);
  
  // 마스터 페이지인 경우 organization-selection 영역을 숨김
  if (isMasterPage) {
    console.log('organization.js - 마스터 페이지 감지, organization-selection 영역 숨김');
    const orgSelection = document.getElementById('organization-selection');
    if (orgSelection) {
      orgSelection.classList.add('hidden');
      console.log('organization-selection 영역을 숨김 처리 완료');
    } else {
      console.log('organization-selection 요소를 찾을 수 없음');
    }
    return; // 추가 처리 중단
  }
  
  // 로그인 화면인지 확인
  const loginContainer = document.getElementById('login-container');
  if (loginContainer && window.getComputedStyle(loginContainer).display !== 'none') {
    console.log('organization.js - 로그인 화면 감지, API 호출 건너뛰기');
    return;
  }
  
  // API 객체가 등록될 때까지 대기
  await waitForApiObject();
  
  // 기관 정보 로드
  await loadOrganizations();
  
  // 로그인 성공 이벤트 리스너 (로그인 후 기관 정보 다시 로드)
  document.addEventListener('loginSuccess', async (event) => {
    console.log('organization.js - 로그인 성공 이벤트 감지');
    
    // 로그인 타임스탬프 저장 (빈번한 API 호출 방지 로직 우회용)
    localStorage.setItem('lastLoginTime', Date.now().toString());
    
    // 마지막 로드 시간 초기화하여 로딩 제한 방지
    lastLoadTime = 0;
    
    // 잠시 대기 후 기관 정보 다시 로드 (토큰이 저장되기를 기다림)
    setTimeout(async () => {
      await waitForApiObject();
      
      // 로그인 후 첫 로드임을 표시
      console.log('로그인 후 첫 기관 목록 로드 시도');
      const result = await loadOrganizations();
      
      if (!result) {
        // 실패 시 한 번 더 시도
        console.log('첫 로드 실패, 3초 후 재시도');
        setTimeout(async () => {
          await loadOrganizations();
        }, 3000);
      }
    }, 800); // 토큰 저장 대기 시간 약간 증가
  });
}); 