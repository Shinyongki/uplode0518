// 기관 방문 일정을 기관별로 정렬하는 추가 스크립트
console.log('[DEBUG] organization-sort.js 로드됨');

// 특별 관리 기관 목록 (committeeSchedule.js와 동일하게 유지)
// 전역 변수로 중복 선언 방지
if (typeof window.specialOrganizations === 'undefined') {
  window.specialOrganizations = [
    '진주노인통합지원센터',
    '함안군재가노인통합지원센터',
    '창녕군새누리노인통합지원센터',
    '효능원노인통합지원센터',
    '진해서부노인종합복지관'
  ];
}
// 전역 변수 직접 참조 - 중복 선언 방지

// 페이지 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', () => {
  // 5초 후 실행 (기존 스크립트가 모두 로드되고 실행된 후)
  setTimeout(() => {
    organizeSchedulesByOrganization();
  }, 3000);
});

// 기관별로 일정 정리 함수
function organizeSchedulesByOrganization() {
  console.log('[DEBUG] 기관별 일정 정리 시작');
  
  // 각 위원 섹션 찾기
  const committeeSections = document.querySelectorAll('#committee-schedules-container > div');
  
  committeeSections.forEach(section => {
    // 위원명 찾기
    const committeeName = section.querySelector('h3')?.textContent?.trim().replace(' 위원', '') || '';
    console.log(`[DEBUG] 위원 섹션 처리: ${committeeName}`);
    
    // 테이블 본문 찾기
    const tableBody = section.querySelector('tbody');
    if (!tableBody) return;
    
    // 모든 행 가져오기
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    if (rows.length === 0) return;
    
    console.log(`[DEBUG] ${committeeName} 위원 일정 ${rows.length}개 발견`);
    
    // 각 행에서 기관명 추출하여 그룹화
    const orgGroups = {};
    
    rows.forEach(row => {
      // 기관명이 있는 셀 (3번째 셀)
      const orgNameCell = row.cells[2];
      if (!orgNameCell) return;
      
      // 기관명 텍스트 추출 (모든 내부 태그 제외하고 순수 텍스트만)
      const orgNameText = orgNameCell.textContent.trim();
      
      if (!orgGroups[orgNameText]) {
        orgGroups[orgNameText] = [];
      }
      
      // 해당 행을 기관 그룹에 추가
      orgGroups[orgNameText].push(row.cloneNode(true));
    });
    
    console.log(`[DEBUG] ${committeeName} 위원 담당 기관 ${Object.keys(orgGroups).length}개 그룹화 완료`);
    
    // 기관 정렬: 특별 관리 기관 먼저, 나머지는 가나다순
    const sortedOrgNames = Object.keys(orgGroups).sort((a, b) => {
      const isSpecialA = window.specialOrganizations.some(special => a.includes(special));
      const isSpecialB = window.specialOrganizations.some(special => b.includes(special));
      
      if (isSpecialA && !isSpecialB) return -1;
      if (!isSpecialA && isSpecialB) return 1;
      return a.localeCompare(b);
    });
    
    // 테이블 비우기
    tableBody.innerHTML = '';
    
    // 정렬된 순서대로 행 추가
    sortedOrgNames.forEach(orgName => {
      // 각 기관 내에서 날짜순 정렬
      orgGroups[orgName].sort((a, b) => {
        const dateA = a.cells[0].textContent.trim();
        const dateB = b.cells[0].textContent.trim();
        return dateA.localeCompare(dateB);
      });
      
      // 정렬된 행 추가
      orgGroups[orgName].forEach(row => {
        tableBody.appendChild(row);
      });
    });
    
    console.log(`[DEBUG] ${committeeName} 위원 일정 기관별 정렬 완료`);
  });
  
  console.log('[DEBUG] 모든 위원 일정 기관별 정렬 완료');
}
