// 위원 관련 모델
const { readSheetData } = require('../config/googleSheets');
const { getCommittees } = require('../services/sheetService');
// 환경 변수에서 스프레드시트 ID 가져오기, 없으면 하드코딩된 값 사용
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
// 위원 정보를 위한 시트 범위
const COMMITTEES_RANGE = 'committees!A:C'; // 위원ID, 위원명, 역할

// 위원 정보를, 이메일 기준으로 가져오기
const getCommitteeByEmail = async (email) => {
  // 더미 데이터 (실제 구현에서는 데이터베이스나 외부 API 호출)
  const dummyCommittees = [
    {
      id: 'C001',
      email: 'admin@example.com',
      name: '관리자',
      role: 'admin',
      isAdmin: true
    },
    {
      id: 'C002', 
      email: 'monitor1@example.com',
      name: '모니터링위원1',
      role: 'monitor',
      isAdmin: false
    },
    {
      id: 'C003',
      email: 'monitor2@example.com',
      name: '모니터링위원2',
      role: 'monitor',
      isAdmin: false
    }
  ];
  
  // 이메일로 위원 찾기
  const committee = dummyCommittees.find(c => c.email === email);
  return committee || null;
};

// 위원 정보를 ID 기준으로 가져오기
const getCommitteeById = async (id) => {
  // 더미 데이터
  const dummyCommittees = [
    {
      id: 'C001',
      email: 'admin@example.com',
      name: '관리자',
      role: 'admin',
      isAdmin: true,
      phone: '010-1234-5678'
    },
    {
      id: 'C002', 
      email: 'monitor1@example.com',
      name: '모니터링위원1',
      role: 'monitor',
      isAdmin: false,
      phone: '010-2345-6789'
    },
    {
      id: 'C003',
      email: 'monitor2@example.com',
      name: '모니터링위원2',
      role: 'monitor',
      isAdmin: false,
      phone: '010-3456-7890'
    }
  ];
  
  // ID로 위원 찾기
  const committee = dummyCommittees.find(c => c.id === id);
  return committee || null;
};

// 모든 위원 정보 가져오기
const getAllCommittees = async () => {
  try {
    console.log('구글 시트에서 위원 목록 조회 중...');
    
    // 실제 구글 시트에서 데이터 가져오기 시도
    try {
      // 서비스 사용을 통해 데이터 가져오기
      const committees = await getCommittees();
      
      if (committees && committees.length > 0) {
        console.log(`구글 시트에서 ${committees.length}개 위원 데이터 로드됨`);
        // 구글 시트에서 가져온 데이터 추가 정보로 보강
        return committees.map(committee => ({
          ...committee,
          email: `${committee.name.replace(/\s+/g, '')}@example.com`, // 임의 이메일 생성
          phone: '010-0000-0000', // 기본 전화번호
          isAdmin: committee.role === 'master' || committee.role === 'admin'
        }));
      }
    } catch (serviceError) {
      console.error('getCommittees 서비스 호출 오류:', serviceError);
      
      // 백업: 직접 시트 데이터 읽기
      try {
        console.log('readSheetData로 직접 시트 데이터 읽기 시도...');
        const values = await readSheetData(SPREADSHEET_ID, COMMITTEES_RANGE);
        
        if (values && values.length >= 2) {
          // 헤더를 제외한 실제 데이터
          const headers = values[0];
          const rows = values.slice(1);
          console.log(`총 ${rows.length}개 위원 데이터 로드됨`);
          
          // 위원 데이터 변환
          return rows.map(row => ({
            id: `C${row[0]}`,
            name: row[1] || '',
            role: row[2] || 'committee',
            email: `${(row[1] || '').replace(/\s+/g, '')}@example.com`, // 임의 이메일 생성
            phone: '010-0000-0000', // 기본 전화번호
            isAdmin: (row[2] || '').includes('master') || (row[2] || '').includes('admin')
          }));
        }
      } catch (readError) {
        console.error('직접 시트 데이터 읽기 오류:', readError);
      }
    }
    
    // 두 방법 모두 실패한 경우 더미 데이터 반환
    console.log('실제 데이터 가져오기 실패, 더미 데이터 사용');
    return [
      {
        id: 'C001',
        email: 'admin@example.com',
        name: '관리자',
        role: 'admin',
        isAdmin: true,
        phone: '010-1234-5678'
      },
      {
        id: 'C002', 
        email: 'monitor1@example.com',
        name: '모니터링위원1',
        role: 'monitor',
        isAdmin: false,
        phone: '010-2345-6789'
      },
      {
        id: 'C003',
        email: 'monitor2@example.com',
        name: '모니터링위원2',
        role: 'monitor',
        isAdmin: false,
        phone: '010-3456-7890'
      }
    ];
  } catch (error) {
    console.error('위원 목록 조회 중 오류:', error);
    // 오류가 발생해도 더미 데이터 반환
    return [
      {
        id: 'C001',
        email: 'admin@example.com',
        name: '관리자',
        role: 'admin',
        isAdmin: true,
        phone: '010-1234-5678'
      }
    ];
  }
};

module.exports = {
  getCommitteeByEmail,
  getCommitteeById,
  getAllCommittees
}; 