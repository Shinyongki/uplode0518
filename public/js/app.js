// 메인 애플리케이션 JavaScript

// 앱 초기화
const initApp = async () => {
  // 로그인 폼 제출 이벤트 리스너
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const committeeNameInput = document.getElementById('committee-name');
      const committeeName = committeeNameInput.value.trim();
      
      if (!committeeName) {
        alert('이름을 입력해주세요.');
        return;
      }
      
      try {
        const response = await login(committeeName);
        
        if (response.status === 'success') {
          // 로그인 성공 후 UI 업데이트
          updateUIAfterLogin();
          
          // 현재 사용자 정보 확인
          const currentUser = getCurrentUser();
          
          // 마스터 관리자인 경우 마스터 대시보드 표시
          if (currentUser && currentUser.role === 'master') {
            initiateMasterDashboard();
          } else {
            // 일반 모니터링 위원인 경우, 토큰이 설정될 때까지 잠시 대기 후 담당 기관 목록 표시
            // 토큰 설정 이벤트 감지
            const waitForToken = () => {
              return new Promise((resolve) => {
                // 토큰이 이미 유효한지 확인
                if (typeof getToken === 'function') {
                  const token = getToken();
                  if (token && token !== 'dummy-token-for-development' && token.length > 10) {
                    console.log('유효한 토큰 확인됨, 기관 목록 로드 진행');
                    resolve();
                    return;
                  }
                }
                
                // 토큰 이벤트 리스너 설정
                const tokenReadyListener = () => {
                  console.log('토큰 준비 이벤트 감지됨');
                  document.removeEventListener('auth:token-ready', tokenReadyListener);
                  resolve();
                };
                
                // 토큰 이벤트 감지
                document.addEventListener('auth:token-ready', tokenReadyListener);
                
                // 일정 시간 후에도 이벤트가 발생하지 않으면 타임아웃 처리
                setTimeout(() => {
                  document.removeEventListener('auth:token-ready', tokenReadyListener);
                  console.log('토큰 대기 타임아웃, 기관 목록 로드 진행');
                  resolve();
                }, 3000);
              });
            };
            
            // 토큰 준비 대기 후 기관 목록 로드
            await waitForToken();
            loadOrganizations();
          }
        } else {
          alert(response.message || '로그인에 실패했습니다. 이름을 다시 확인해주세요.');
        }
      } catch (error) {
        console.error('로그인 처리 중 오류 발생:', error);
        alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    });
  }
  
  // 로그아웃 버튼 이벤트 리스너
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await logout(); // 비동기 로그아웃 함수 호출 및 완료 대기
        // 성공적으로 로그아웃된 경우, updateUIAfterLogout()는 이미 logout() 함수 내에서 호출됨
      } catch (error) {
        console.error('로그아웃 처리 중 오류 발생:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
        // 오류 발생 시에도 UI 업데이트 시도
        updateUIAfterLogout();
      }
    });
  }
  
  // 기관 목록으로 돌아가기 버튼 이벤트 리스너
  const backToOrgsBtn = document.getElementById('back-to-orgs-btn');
  if (backToOrgsBtn) {
    backToOrgsBtn.addEventListener('click', () => {
      // 마스터 관리자일 경우 마스터 대시보드로 돌아가기
      if (isMaster()) {
        initiateMasterDashboard();
      } else {
        // 일반 사용자일 경우 기관 선택 화면으로 돌아가기
        document.getElementById('monitoring-indicators').classList.add('hidden');
        document.getElementById('organization-selection').classList.remove('hidden');
      }
    });
  }
  
  // 페이지 로드 시 인증 상태 확인
  try {
    const authResponse = await checkAuth();
    
    if (authResponse.status === 'success') {
      updateUIAfterLogin();
      
      // 현재 사용자 정보 확인
      const currentUser = getCurrentUser();
      
      // 마스터 관리자인 경우 마스터 대시보드 표시
      if (currentUser && currentUser.role === 'master') {
        initiateMasterDashboard();
      } else {
        // 일반 모니터링 위원인 경우 담당 기관 목록 표시
        // 토큰이 설정될 때까지 잠시 대기
        if (typeof getToken === 'function' && (!getToken() || getToken() === 'dummy-token-for-development')) {
          console.log('유효한 토큰이 없어 토큰 설정 대기');
          
          // 토큰 설정까지 약간의 지연 추가
          setTimeout(() => {
            loadOrganizations();
          }, 800);
        } else {
          // 토큰이 이미 있으면 바로 로드
          loadOrganizations();
        }
      }
    } else {
      updateUIAfterLogout();
    }
  } catch (error) {
    console.error('인증 상태 확인 중 오류 발생:', error);
    updateUIAfterLogout();
  }
};

// 페이지 로드 시 실행할 함수
document.addEventListener('DOMContentLoaded', async () => {
  console.log('===== 애플리케이션 초기화 시작 =====');
  
  // 로그인 화면인지 확인
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  
  console.log(`- 로그인 컨테이너 존재: ${loginContainer ? 'O' : 'X'}`);
  console.log(`- 대시보드 컨테이너 존재: ${dashboardContainer ? 'O' : 'X'}`);
  
  const isLoginPage = loginContainer && 
                      window.getComputedStyle(loginContainer).display !== 'none';
  const isDashboardHidden = dashboardContainer && 
                        window.getComputedStyle(dashboardContainer).display === 'none';
                        
  console.log(`- 로그인 화면 표시 중: ${isLoginPage ? 'O' : 'X'}`);
  console.log(`- 대시보드 숨김 상태: ${isDashboardHidden ? 'O' : 'X'}`);
  
  // 로그인 화면 처리
  if (isLoginPage) {
    console.log('** 로그인 화면 감지 **');
    
    // 임시 사용자 정보 설정
    if (typeof setCurrentUser === 'function') {
      setCurrentUser({
        id: 'C001',
        name: '신용기',
        role: 'committee',
        isAdmin: false
      });
      console.log('- 임시 사용자 정보 설정됨');
      
      // 로그인 후 UI 업데이트 함수 실행
      if (typeof updateUIAfterLogin === 'function') {
        console.log('- updateUIAfterLogin 호출');
        updateUIAfterLogin();
      }
      
      // 마스터 대시보드 초기화 방지
      window.isMasterDashboard = false;
      console.log('- 마스터 대시보드 플래그 초기화');
    }
    
    // 기관 목록 로드 트리거
    setTimeout(() => {
      if (typeof loadOrganizations === 'function') {
        console.log('- 기관 목록 로드 시도');
        loadOrganizations();
      }
    }, 500);
    
    // 이벤트 발생 시뮬레이션
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('auth:token-ready', { 
        detail: { token: 'temp-token-' + Date.now() }
      }));
      console.log('- 토큰 준비 이벤트 발생시킴');
    }, 1000);
    
    // 로그인 화면일 때는 자동 API 호출을 하지 않음
    if (typeof window.updateAuthUI === 'function') {
      window.updateAuthUI(false);
    } else if (typeof updateAuthUI === 'function') {
      updateAuthUI(false);
    } else {
      console.error('updateAuthUI 함수를 찾을 수 없습니다.');
    }
    
    // organization.js에서 자동 실행될 수 있는 함수 방지
    window.skipInitialApiCalls = true;
    
    console.log('- 로그인 폼 이벤트 리스너 설정');
    setupLoginForm();
  } else {
    console.log('** 대시보드 화면 감지 - 인증 상태 확인 **');
    // 로그인 상태 확인
    try {
      console.log('- 인증 상태 확인 시작');
      if (typeof checkAuth === 'function') {
        await checkAuth();
      }
      console.log('- 인증 상태 확인 완료');
      
      // 페이지 복귀 시 이전 상태 복원
      // 로컬 스토리지에 저장된 마지막 활성 탭 확인
      const lastActiveTab = localStorage.getItem('last_active_tab');
      
      // 캘린더 일정 데이터 복원 (다른 페이지에서 사용할 수 있도록)
      try {
        const storedSchedules = localStorage.getItem('calendar_schedules');
        if (storedSchedules) {
          const parsedSchedules = JSON.parse(storedSchedules);
          if (parsedSchedules && parsedSchedules.length > 0) {
            console.log('로컬 스토리지에서 일정 데이터 복원:', parsedSchedules.length);
            window.calendarSchedules = parsedSchedules;
          }
        }
      } catch (err) {
        console.error('일정 데이터 복원 중 오류:', err);
      }
    } catch (error) {
      console.error('- 인증 확인 중 오류:', error);
    }
  }
  
  // 기타 이벤트 리스너 설정
  console.log('- 이벤트 리스너 설정 시작');
  setupEventListeners();
  console.log('- 이벤트 리스너 설정 완료');
  
  // 토큰 이벤트 리스너 설정
  document.addEventListener('auth:token-ready', (event) => {
    console.log('토큰 준비 이벤트 감지:', event.detail);
    
    // 로그인 페이지가 아닌 경우에만 이벤트 처리
    if (!isLoginPage) {
      // 토큰 준비 완료 이벤트 발생시킴
      console.log('- 토큰 준비 이벤트 발생시킴');
      
      // 현재 사용자 확인
      const currentUser = getCurrentUser();
      if (currentUser) {
        console.log('토큰 준비 완료 - 사용자:', currentUser.name);
        
        // 기관 목록 로드 시도
        setTimeout(() => {
          if (typeof loadOrganizations === 'function') {
            console.log('토큰 준비 후 기관 목록 로드 시도');
            loadOrganizations();
          }
        }, 500);
      }
    }
  });
  
  console.log('===== 애플리케이션 초기화 완료 =====');
});

// 로그인 후 UI 업데이트
const updateUIAfterLogin = () => {
  document.getElementById('login-container').classList.add('hidden');
  document.getElementById('dashboard-container').classList.remove('hidden');
  
  // 로그인 화면이 아니므로 API 호출 플래그 리셋
  window.skipInitialApiCalls = false;
  console.log('로그인 완료 - API 호출 플래그 리셋됨:', window.skipInitialApiCalls);
  
  // 사용자 이름 표시
  const currentUser = getCurrentUser();
  const userNameElement = document.getElementById('user-name');
  
  if (userNameElement && currentUser) {
    // 마스터 관리자인 경우 다르게 표시
    if (currentUser.role === 'master') {
      userNameElement.textContent = `${currentUser.name}`;
    } else {
      userNameElement.textContent = `${currentUser.name} 위원님`;
    }
  }
  
  // 마스터 계정인 경우 마스터 대시보드 표시
  if (currentUser && currentUser.role === 'master') {
    // 마스터 계정이면 마스터 대시보드 표시
    console.log('마스터 계정 감지: 마스터 대시보드 초기화 실행');
    initiateMasterDashboard();
  } else {
    // 일반 계정인 경우 마스터 대시보드 숨김 및 기관 목록 표시
    console.log('일반 위원 계정 감지: 기관 목록 표시');
    try {
      // 마스터 대시보드 영역 숨기기
      const masterDashboard = document.getElementById('master-dashboard');
      if (masterDashboard) {
        masterDashboard.classList.add('hidden');
      }
      
      // 일반 위원 화면 표시
      const organizationSelection = document.getElementById('organization-selection');
      if (organizationSelection) {
        organizationSelection.classList.remove('hidden');
      }
      
      // 기관 목록 로드 (토큰 설정 후)
      console.log('토큰 상태 확인 후 기관 목록 로드');
      setTimeout(() => {
        // 토큰이 유효한지 확인
        if (typeof getToken === 'function') {
          const token = getToken();
          if (!token || token === 'dummy-token-for-development') {
            console.log('유효한 토큰이 없음, 토큰이 설정될 때까지 대기');
            
            // 토큰 설정 이벤트 리스너 등록
            const tokenReadyListener = () => {
              console.log('토큰 준비 이벤트 감지, 기관 목록 로드');
              document.removeEventListener('auth:token-ready', tokenReadyListener);
              loadOrganizations();
            };
            
            document.addEventListener('auth:token-ready', tokenReadyListener);
            
            // 5초 후에도 토큰이 설정되지 않으면 어쨌든 로드 시도
            setTimeout(() => {
              document.removeEventListener('auth:token-ready', tokenReadyListener);
              console.log('토큰 대기 시간 초과, 그래도 기관 목록 로드 시도');
              loadOrganizations();
            }, 5000);
          } else {
            console.log('유효한 토큰 있음, 기관 목록 로드 진행');
            loadOrganizations();
          }
        } else {
          console.log('getToken 함수 없음, 기관 목록 로드 진행');
          loadOrganizations();
        }
      }, 300); // 약간의 지연 추가
    } catch (error) {
      console.error('일반 위원 화면 표시 중 오류 발생:', error);
    }
  }
};

// 로그아웃 후 UI 업데이트
const updateUIAfterLogout = () => {
  document.getElementById('login-container').classList.remove('hidden');
  document.getElementById('dashboard-container').classList.add('hidden');
  
  // 입력 필드 초기화
  const committeeNameInput = document.getElementById('committee-name');
  if (committeeNameInput) {
    committeeNameInput.value = '';
  }
  
  // 마스터 대시보드가 있으면 숨기기
  const masterDashboard = document.getElementById('master-dashboard');
  if (masterDashboard) {
    masterDashboard.classList.add('hidden');
  }
};

// 마스터 대시보드 초기화
const initiateMasterDashboard = () => {
  console.log('마스터 대시보드 초기화 시작');
  
  // 테스트 모드에서는 마스터 대시보드 초기화 건너뛰기
  if (window.isMasterDashboard === false) {
    console.log('테스트 모드에서는 마스터 대시보드 초기화를 건너뚰니다.');
    return;
  }
  
  // 마스터 대시보드 화면 표시
  const masterDashboard = document.getElementById('master-dashboard');
  if (masterDashboard) {
    masterDashboard.classList.remove('hidden');
    
    // 기관 선택 화면 숨김
    const orgSelection = document.getElementById('organization-selection');
    if (orgSelection) {
      orgSelection.classList.add('hidden');
    }
    
    // 매니터링 지표 화면 숨김
    const monitoringIndicators = document.getElementById('monitoring-indicators');
    if (monitoringIndicators) {
      monitoringIndicators.classList.add('hidden');
    }
    
    // 마스터 대시보드 데이터 로드
    if (typeof loadMasterDashboardData === 'function') {
      loadMasterDashboardData();
    }
    
    // 타이틀 변경
    const dashboardTitle = document.querySelector('.dashboard-title');
    if (dashboardTitle) {
      dashboardTitle.textContent = '마스터 대시보드';
    }
  }
};

// setupLoginForm 함수 추가
const setupLoginForm = () => {
  // 로그인 폼 제출 이벤트 리스너
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const committeeNameInput = document.getElementById('committee-name');
      const committeeName = committeeNameInput.value.trim();
      
      if (!committeeName) {
        alert('이름을 입력해주세요.');
        return;
      }
      
      try {
        console.log(`로그인 시도: ${committeeName}`);
        
        // window.login 함수 사용 (auth.js에서 노출된 전역 함수)
        if (typeof window.login === 'function') {
          const response = await window.login(committeeName);
          
          if (response.status === 'success') {
            // 로그인 성공 후 UI 업데이트
            updateUIAfterLogin();
            
            // 현재 사용자 정보 확인
            const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
            
            // 마스터 관리자인 경우 마스터 대시보드 표시
            if (currentUser && currentUser.role === 'master') {
              initiateMasterDashboard();
            } else {
              // 일반 모니터링 위원인 경우 담당 기관 목록 표시
              if (typeof loadOrganizations === 'function') {
                loadOrganizations();
              }
            }
          } else {
            alert(response.message || '로그인에 실패했습니다. 이름을 다시 확인해주세요.');
          }
        } else {
          console.error('login 함수를 찾을 수 없습니다. auth.js가 제대로 로드되었는지 확인하세요.');
          alert('로그인 처리를 위한 함수를 찾을 수 없습니다. 페이지를 새로고침하고 다시 시도해주세요.');
        }
      } catch (error) {
        console.error('로그인 처리 중 오류 발생:', error);
        alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    });
  }
};

// setupEventListeners 함수 추가
const setupEventListeners = () => {
  // 로그아웃 버튼 이벤트 리스너
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        // window.logout 함수 사용 (auth.js에서 노출된 전역 함수)
        if (typeof window.logout === 'function') {
          await window.logout(); // 비동기 로그아웃 함수 호출 및 완료 대기
        } else {
          console.error('logout 함수를 찾을 수 없습니다.');
          // 함수가 없어도 UI를 로그아웃 상태로 업데이트
          updateUIAfterLogout();
        }
      } catch (error) {
        console.error('로그아웃 처리 중 오류 발생:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
        // 오류 발생 시에도 UI 업데이트 시도
        updateUIAfterLogout();
      }
    });
  }
  
  // 기관 목록으로 돌아가기 버튼 이벤트 리스너
  const backToOrgsBtn = document.getElementById('back-to-orgs-btn');
  if (backToOrgsBtn) {
    backToOrgsBtn.addEventListener('click', () => {
      // 마스터 관리자일 경우 마스터 대시보드로 돌아가기
      if (typeof window.isMaster === 'function' && window.isMaster()) {
        initiateMasterDashboard();
      } else {
        // 일반 사용자일 경우 기관 선택 화면으로 돌아가기
        document.getElementById('monitoring-indicators').classList.add('hidden');
        document.getElementById('organization-selection').classList.remove('hidden');
      }
    });
  }
};

// 주기 탭 클릭 처리를 위한 이벤트 설정
document.addEventListener('DOMContentLoaded', () => {
  console.log('app.js - DOMContentLoaded 이벤트 발생');
  
  // 로그인 화면인지 확인
  const loginContainer = document.getElementById('login-container');
  if (loginContainer && !loginContainer.classList.contains('hidden')) {
    console.log('app.js - 로그인 화면 감지, 초기화 건너뛰기');
    return;
  }
  
  // 주기 탭 직접 접근 및 이벤트 처리
  setTimeout(() => {
    console.log('app.js - 주기 탭 직접 접근');
    
    // 각 주기 탭에 직접 클릭 이벤트 추가
    const tabMonthly = document.getElementById('tab-monthly');
    const tabSemiannual = document.getElementById('tab-semiannual');
    const tabQ1 = document.getElementById('tab-q1');
    
    console.log('주기 탭 요소:', { 
      매월: tabMonthly, 
      반기: tabSemiannual, 
      '1~3월': tabQ1 
    });
    
    // 특별 클릭 이벤트 처리
    if (tabSemiannual) {
      tabSemiannual.addEventListener('click', (e) => {
        console.log('app.js - 반기 탭 클릭 감지');
        // 기존 이벤트 처리 이후
        setTimeout(() => {
          // 기관이 선택되었는지 확인
          const selectedOrg = window.selectedOrganization;
          if (!selectedOrg) {
            console.log('기관이 선택되지 않음');
            return;
          }
          
          // 로딩 표시
          const sidebar = document.getElementById('indicators-list-sidebar');
          if (sidebar && sidebar.innerHTML.includes('지표가 없습니다') || sidebar.innerHTML.trim() === '') {
            console.log('지표 없음 - 직접 지표 로드 시도');
            sidebar.innerHTML = '<div class="p-4 text-center text-gray-500">반기 지표를 불러오는 중...</div>';
            
            // 반기 지표 직접 로드 시도
            try {
              // 전역 함수 호출
              if (typeof loadIndicatorsByPeriod === 'function') {
                console.log('loadIndicatorsByPeriod 함수 호출');
                loadIndicatorsByPeriod('반기');
              }
            } catch (error) {
              console.error('반기 지표 직접 로드 중 오류:', error);
            }
          }
        }, 500);
      });
    }
    
    if (tabQ1) {
      tabQ1.addEventListener('click', (e) => {
        console.log('app.js - 1~3월 탭 클릭 감지');
        // 기존 이벤트 처리 이후
        setTimeout(() => {
          // 기관이 선택되었는지 확인
          const selectedOrg = window.selectedOrganization;
          if (!selectedOrg) {
            console.log('기관이 선택되지 않음');
            return;
          }
          
          // 로딩 표시
          const sidebar = document.getElementById('indicators-list-sidebar');
          if (sidebar && sidebar.innerHTML.includes('지표가 없습니다') || sidebar.innerHTML.trim() === '') {
            console.log('지표 없음 - 직접 지표 로드 시도');
            sidebar.innerHTML = '<div class="p-4 text-center text-gray-500">1~3월 지표를 불러오는 중...</div>';
            
            // 1~3월 지표 직접 로드 시도
            try {
              // 전역 함수 호출
              if (typeof loadIndicatorsByPeriod === 'function') {
                console.log('loadIndicatorsByPeriod 함수 호출');
                loadIndicatorsByPeriod('1~3월');
              }
            } catch (error) {
              console.error('1~3월 지표 직접 로드 중 오류:', error);
            }
          }
        }, 500);
      });
    }
    
    console.log('주기 탭 이벤트 직접 등록 완료');
  }, 2000); // 페이지 로드 후 2초 지연
});