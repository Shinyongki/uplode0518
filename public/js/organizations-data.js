// 기본 기관 데이터
const defaultOrganizations = [
  { id: 'A48240001', code: 'A48240001', name: '서울특별시 노인복지센터', description: '노인복지센터' },
  { id: 'A48240002', code: 'A48240002', name: '강남구 노인복지센터', description: '노인복지센터' },
  { id: 'A48240003', code: 'A48240003', name: '강동구 노인복지센터', description: '노인복지센터' },
  { id: 'A48240004', code: 'A48240004', name: '강북구 노인복지센터', description: '노인복지센터' },
  { id: 'A48240005', code: 'A48240005', name: '강서구 노인복지센터', description: '노인복지센터' },
  { id: 'A48240006', code: 'A48240006', name: '관악구 노인복지센터', description: '노인복지센터' }
];

// 기본 위원 데이터
const defaultCommittees = [
  { id: 'committee1', name: '김위원', role: '위원장', department: '사회복지과', organizationCodes: ['A48240001', 'A48240002'] },
  { id: 'committee2', name: '이위원', role: '위원', department: '사회복지과', organizationCodes: ['A48240003', 'A48240004'] },
  { id: 'committee3', name: '박위원', role: '위원', department: '사회복지과', organizationCodes: ['A48240005', 'A48240006'] }
];

// 전역 변수로 노출
window.defaultOrganizations = defaultOrganizations;
window.defaultCommittees = defaultCommittees;
