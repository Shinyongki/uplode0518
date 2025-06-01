// 위원 데이터 샘플
const committeesList = [
  { id: 'C001', name: '김모니터', mainOrgs: ['동진노인통합지원센터', '창원도우누리노인통합재가센터', '명진노인통합지원센터'], subOrgs: ['진양노인통합지원센터', '진주노인통합지원센터'] },
  { id: 'C002', name: '이평가', mainOrgs: ['김해시종합사회복지관', '생명의전화노인통합지원센터', '보현행원노인통합지원센터'], subOrgs: ['통영시종합사회복지관', '통영노인통합지원센터'] },
  { id: 'C003', name: '박검사', mainOrgs: ['밀양시자원봉사단체협의회', '밀양노인통합지원센터', '거제노인통합지원센터'], subOrgs: ['의령노인통합지원센터', '함안군재가노인통합지원센터'] },
  { id: 'C004', name: '최관리', mainOrgs: ['대한노인회 고성군지회', '화방남해노인통합지원센터', '하동노인통합지원센터'], subOrgs: ['동진노인통합지원센터', '명진노인통합지원센터'] },
  { id: 'C005', name: '정돌봄', mainOrgs: ['산청한일노인통합지원센터', '거창노인통합지원센터', '합천노인통합지원센터'], subOrgs: ['김해시종합사회복지관', '보현행원노인통합지원센터'] }
];

// 기관 데이터 샘플
const organizationsList = [
  { id: 'O001', code: 'A48120001', name: '동진노인통합지원센터', address: '경남 창원시 의창구' },
  { id: 'O002', code: 'A48120002', name: '창원도우누리노인통합재가센터', address: '경남 창원시 성산구' },
  { id: 'O003', code: 'A48120004', name: '명진노인통합지원센터', address: '경남 창원시 마산합포구' },
  { id: 'O004', code: 'A48170001', name: '진양노인통합지원센터', address: '경남 진주시 진양구' },
  { id: 'O005', code: 'A48170002', name: '진주노인통합지원센터', address: '경남 진주시 상대동' },
  { id: 'O006', code: 'A48250004', name: '김해시종합사회복지관', address: '경남 김해시 삼방동' },
  { id: 'O007', code: 'A48250005', name: '생명의전화노인통합지원센터', address: '경남 김해시 내동' },
  { id: 'O008', code: 'A48250006', name: '보현행원노인통합지원센터', address: '경남 김해시 장유동' },
  { id: 'O009', code: 'A48220002', name: '통영시종합사회복지관', address: '경남 통영시 무전동' },
  { id: 'O010', code: 'A48220003', name: '통영노인통합지원센터', address: '경남 통영시 도남동' }
];

// 지표 데이터 샘플
const indicatorsList = [
  { id: 'I001', code: 'M001', name: '모인우리 수행기관 상세현황 현행화', category: '매월', description: '수행기관 상세현황 정보의 현행화 여부', 검토자료: '모인우리 수행기관 상세현황 정보', 공통필수: 'O', 온라인점검: '필수' },
  { id: 'I002', code: 'M002', name: '종사자 채용현황', category: '매월', description: '종사자 채용 현황 점검', 검토자료: '모인우리 배정 및 채용인원, 배정현황 변경 근거서류', 공통필수: 'O', 평가연계: 'O', 온라인점검: '필수' },
  { id: 'I003', code: 'M003', name: '종사자 근속현황', category: '매월', description: '종사자 근속 현황 점검', 검토자료: '모인우리 배정 및 채용인원', 공통필수: 'O', 평가연계: 'O', 온라인점검: '필수' },
  { id: 'I004', code: 'H001', name: '직원 역량강화 교육', category: '반기', description: '직원의 전문성 향상을 위한 교육계획을 수립하여 시행하고 있는가?', 공통선택: 'O', 평가연계: 'O', 온라인점검: '선택', 현장점검: '우선' },
  { id: 'I005', code: 'H002', name: '슈퍼비전 체계', category: '반기', description: '서비스 질 향상을 위한 슈퍼비전 체계를 갖추고 있는가?', 공통선택: 'O', 평가연계: 'O', 온라인점검: '선택', 현장점검: '우선' },
  { id: 'I006', code: 'Y001', name: '재정관리의 투명성', category: '연중', description: '기관 재정이 투명하게 관리되고 있는가?', 공통선택: 'O', 온라인점검: '선택', 현장점검: '우선' },
  { id: 'I007', code: 'Y002', name: '평가 및 환류체계', category: '연중', description: '서비스 평가 및 환류체계를 갖추고 있는가?', 공통선택: 'O', 온라인점검: '선택', 현장점검: '우선' },
  { id: 'I008', code: 'Q001', name: '안전관리 체계', category: '1~3월', description: '이용자와 직원의 안전을 위한 체계를 갖추고 있는가?', 공통선택: 'O', 온라인점검: '우선', 현장점검: '선택' },
  { id: 'I009', code: 'Q002', name: '개인정보 보호체계', category: '1~3월', description: '이용자 개인정보 보호를 위한 체계를 갖추고 있는가?', 공통선택: 'O', 온라인점검: '우선', 현장점검: '선택' },
  { id: 'I010', code: 'Q003', name: '고충처리 체계', category: '1~3월', description: '이용자 고충처리를 위한 체계를 갖추고 있는가?', 공통선택: 'O', 온라인점검: '우선', 현장점검: '선택' }
];

// 위원 인증 함수
const authenticateCommittee = async (committeeName) => {
  const committee = committeesList.find(c => c.name === committeeName);
  return committee || null;
};

// 위원의 담당 기관 목록 가져오기
const getCommitteeOrganizations = async (committeeName) => {
  const committee = committeesList.find(c => c.name === committeeName);
  if (!committee) return { mainOrgs: [], subOrgs: [] };
  
  const mainOrganizations = committee.mainOrgs.map(name => {
    return organizationsList.find(org => org.name === name);
  }).filter(Boolean);
  
  const subOrganizations = committee.subOrgs.map(name => {
    return organizationsList.find(org => org.name === name);
  }).filter(Boolean);
  
  return {
    mainOrgs: mainOrganizations,
    subOrgs: subOrganizations
  };
};

// 모니터링 지표 목록 가져오기
const getIndicators = async () => {
  return indicatorsList;
};

// 특정 기관의 지표별 모니터링 결과 가져오기
const getMonitoringResults = async (orgId, committeeName) => {
  // 샘플 결과 데이터 생성
  return indicatorsList.map(indicator => {
    return {
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      indicatorCategory: indicator.category,
      result: Math.random() > 0.7 ? '충족' : Math.random() > 0.5 ? '미충족' : '해당없음',
      comment: `${indicator.name}에 대한 평가 의견입니다.`,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
  });
};

module.exports = {
  committeesList,
  organizationsList,
  indicatorsList,
  authenticateCommittee,
  getCommitteeOrganizations,
  getIndicators,
  getMonitoringResults
}; 