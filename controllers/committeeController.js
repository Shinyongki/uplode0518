// 컨트롤러: 위원 관련 기능 처리
const Committee = require('../models/committee');
const { readSheetData, writeSheetData } = require('../config/googleSheets');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 모든 위원 정보 가져오기
const getAllCommittees = async (req, res) => {
  try {
    const committees = []; // 모델 연결 전에는 빈 배열 반환
    
    return res.status(200).json({
      status: 'success',
      data: { committees }
    });
  } catch (error) {
    console.error('모든 위원 정보 조회 중 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 현재 인증된 위원 정보 가져오기
const getCurrentCommittee = async (req, res) => {
  try {
    // 세션에서 위원 정보 가져오기
    if (!req.session || !req.session.committee) {
      return res.status(401).json({
        status: 'error',
        message: '로그인이 필요합니다.'
      });
    }
    
    const committee = req.session.committee;
    
    return res.status(200).json({
      status: 'success',
      data: { committee }
    });
  } catch (error) {
    console.error('현재 위원 정보 조회 중 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 구글 시트에서 모든 위원 정보 가져오기
const getAllCommitteesFromSheet = async (req, res) => {
  try {
    console.log('getAllCommitteesFromSheet 함수 호출됨');
    console.log('세션 정보:', req.session);
    
    // 마스터 계정 확인 - 임시로 주석 처리하여 모든 계정이 접근 가능하도록 함
    /*
    if (!req.session || !req.session.committee || req.session.committee.role !== 'master') {
      console.log('접근 권한 없음:', req.session?.committee?.role || '로그인하지 않음');
      return res.status(403).json({
        status: 'error',
        message: '마스터 관리자만 접근할 수 있습니다.'
      });
    }
    */
    
    // 구글 시트에서 위원 목록 가져오기 시도
    try {
      console.log('구글 시트에서 위원 목록 조회 중...');
      const sheetRange = 'committees!A:C'; // 위원 정보가 저장된 시트 범위
      const data = await readSheetData(SPREADSHEET_ID, sheetRange);

      if (data && data.length >= 2) {
        // 헤더를 제외한 실제 데이터
        const headers = data[0];
        const rows = data.slice(1);
        console.log(`총 ${rows.length}개 위원 데이터 로드됨`);

        // 위원 데이터 변환
        const committees = rows.map(row => {
          const committee = {};
          headers.forEach((header, index) => {
            if (row[index] !== undefined) {
              committee[header] = row[index];
            } else {
              committee[header] = '';
            }
          });
          return committee;
        });

        return res.status(200).json({
          status: 'success',
          data: { committees }
        });
      } else {
        console.log('구글 시트에서 위원 데이터를 찾을 수 없습니다.');
        // 빈 배열 반환
        return res.status(200).json({
          status: 'success',
          data: { committees: [] },
          message: '위원 데이터가 없습니다. 구글 시트에 데이터를 추가해주세요.'
        });
      }
    } catch (sheetError) {
      console.error('구글 시트 읽기 오류:', sheetError.message);
      throw sheetError; // 에러 전파하여 아래 catch 블록에서 처리
    }
  } catch (error) {
    console.error('위원 목록 조회 중 오류:', error);
    console.error('[에러 상세 정보]:', JSON.stringify(error) || '상세 정보 없음');
    
    // 에러 객체가 undefined인 경우에도 처리
    const errorObj = error || { message: '알 수 없는 오류' };
    
    // 로그에 위원 목록 조회 실패 기록
    console.error('[ERROR] 위원 목록 조회 실패:', errorObj.message || '정의되지 않은 에러');
    
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다. 구글 시트 연결을 확인해주세요.',
      details: process.env.NODE_ENV === 'development' ? (errorObj.message || '알 수 없는 오류') : undefined
    });
  }
};

// 모든 위원-기관 매칭 정보 가져오기
const getAllCommitteeMatchings = async (req, res) => {
  try {
    console.log('위원-기관 매칭 정보 요청됨');
    console.log('세션 정보:', req.session ? JSON.stringify(req.session) : '세션 없음');
    
    // 구글 시트에서 위원-기관 매칭 정보 가져오기
    console.log('구글 시트에서 위원-기관 매칭 정보 조회 중...');
    const sheetRange = '위원별_담당기관!A:H'; // 위원-기관 매칭 정보가 저장된 시트 범위 (점검유형 컬럼 추가)
    
    // 스프레드시트 ID 확인
    if (!SPREADSHEET_ID) {
      console.error('스프레드시트 ID가 설정되지 않았습니다');
      return res.status(500).json({
        status: 'error',
        message: '스프레드시트 ID가 설정되지 않았습니다'
      });
    }
    
    console.log(`사용할 스프레드시트 ID: ${SPREADSHEET_ID}`);
    
    let data;
    try {
      console.log(`readSheetData 호출 전: spreadsheetId=${SPREADSHEET_ID}, range=${sheetRange}`);
      data = await readSheetData(SPREADSHEET_ID, sheetRange);
      console.log('readSheetData 호출 완료, 결과:', data ? `${data.length}개 행 로드됨` : '데이터 없음');
      
      if (!data || data.length === 0) {
        console.warn('구글 시트에서 데이터를 찾을 수 없습니다');
        return res.status(200).json({
          status: 'success',
          data: { 
            matchings: getSampleMatchingData()
          },
          message: '구글 시트에서 데이터를 찾을 수 없어 샘플 데이터가 제공되었습니다',
          source: 'sample_data_empty_sheet'
        });
      }
    } catch (error) {
      console.error('구글 시트 읽기 오류:', error);
      console.error('오류 메시지:', error.message);
      console.error('오류 스택:', error.stack);
      
      // 인증 오류인지 확인
      const isAuthError = error.message && (
        error.message.includes('auth') || 
        error.message.includes('authent') || 
        error.message.includes('token') || 
        error.message.includes('credentials') ||
        error.message.includes('401')
      );
      
      if (isAuthError) {
        console.error('인증 관련 오류로 판단됩니다. 인증 설정을 확인하세요.');
      }
      
      // 샘플 데이터 제공
      return res.status(200).json({
        status: 'success',
        data: { 
          matchings: getSampleMatchingData()
        },
        message: `구글 시트 연결 오류로 샘플 데이터가 제공되었습니다: ${error.message}`,
        source: 'sample_data_error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    // 헤더를 제외한 실제 데이터
    const headers = data[0];
    const rows = data.slice(1);
    console.log(`총 ${rows.length}개 위원-기관 매칭 데이터 로드됨`);
    
    if (rows.length === 0) {
      console.log('헤더만 있고 실제 데이터는 없습니다');
      return res.status(200).json({
        status: 'success',
        data: { 
          matchings: getSampleMatchingData()
        },
        message: '구글 시트에 데이터가 없어 샘플 데이터가 제공되었습니다',
        source: 'sample_data_header_only'
      });
    }

    // 매칭 데이터 변환
    const matchings = rows.map(row => {
      return {
        committeeId: row[0] || '',
        committeeName: row[1] || '',
        orgId: row[2] || '',
        orgCode: row[3] || '',
        orgName: row[4] || '',
        region: row[5] || '',
        role: row[6] || '', // '주담당' 또는 '부담당'
        checkType: row[7] || '전체' // '매월', '반기', '전체' 중 하나
      };
    });
    
    console.log('매칭 데이터 변환 완료. 첫 번째 데이터 샘플:', matchings.length > 0 ? JSON.stringify(matchings[0]) : 'No data');

    return res.status(200).json({
      status: 'success',
      data: { matchings },
      source: 'sheet_data'
    });
  } catch (error) {
    console.error('위원-기관 매칭 정보 조회 중 오류:', error);
    console.error('오류 상세 정보:', JSON.stringify(error) || '상세 정보 없음');
    if (error.stack) {
      console.error('스택 트레이스:', error.stack);
    }
    
    // 오류가 발생하더라도 샘플 데이터 제공
    return res.status(200).json({
      status: 'success',
      data: { 
        matchings: getSampleMatchingData()
      },
      message: '서버 오류로 인해 샘플 데이터가 제공되었습니다',
      source: 'fallback_sample_data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 샘플 매칭 데이터 제공 함수
function getSampleMatchingData() {
  return [
    { committeeId: 'C001', committeeName: '신용기', orgCode: 'A48120001', orgName: '동진노인통합지원센터', region: '창원시 의창구', role: '주담당', checkType: '전체' },
    { committeeId: 'C001', committeeName: '신용기', orgCode: 'A48120002', orgName: '창원도우누리노인종합재가센터', region: '창원시 의창구', role: '주담당', checkType: '전체' },
    { committeeId: 'C002', committeeName: '김수연', orgCode: 'A48220003', orgName: '통영노인통합지원센터', region: '통영시', role: '주담당', checkType: '전체' },
    { committeeId: 'C002', committeeName: '김수연', orgCode: 'A48270003', orgName: '우리들노인통합지원센터', region: '밀양시', role: '주담당', checkType: '전체' },
    { committeeId: 'C003', committeeName: '이정혜', orgCode: 'A48310001', orgName: '거제노인통합지원센터', region: '거제시', role: '주담당', checkType: '전체' },
    { committeeId: 'C003', committeeName: '이정혜', orgCode: 'A48310002', orgName: '거제사랑노인복지센터', region: '거제시', role: '부담당', checkType: '전체' },
    { committeeId: 'C004', committeeName: '이연숙', orgCode: 'A48120006', orgName: '성로노인통합지원센터', region: '창원시 마산합포구', role: '주담당', checkType: '전체' },
    { committeeId: 'C004', committeeName: '이연숙', orgCode: 'A48720001', orgName: '의령노인통합지원센터', region: '의령군', role: '주담당', checkType: '전체' },
    { committeeId: 'C005', committeeName: '문일지', orgCode: 'A48170004', orgName: '공덕의집노인통합지원센터', region: '진주시', role: '부담당', checkType: '전체' },
    { committeeId: 'C005', committeeName: '문일지', orgCode: 'A48730001', orgName: '(사)대한노인회함안군지회', region: '함안군', role: '주담당', checkType: '전체' }
  ];
}

// 위원-기관 매칭 정보 업데이트
const updateCommitteeMatching = async (req, res) => {
  try {
    // 개발 환경에서는 인증 체크 우회
    const bypassAuth = process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true';
    
    // 마스터 계정 확인
    if (!bypassAuth && (!req.session || !req.session.committee || req.session.committee.role !== 'master')) {
      return res.status(403).json({
        status: 'error',
        message: '마스터 관리자만 접근할 수 있습니다.'
      });
    }

    const { matchings } = req.body;

    if (!matchings || !Array.isArray(matchings) || matchings.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 매칭 정보가 필요합니다.'
      });
    }

    // 기존 시트 데이터 가져오기
    console.log('기존 위원-기관 매칭 정보 조회 중...');
    const sheetRange = '위원별_담당기관!A:H'; // 점검유형 컬럼 추가
    const existingData = await readSheetData(SPREADSHEET_ID, sheetRange);
    
    // 헤더 정보
    const headers = existingData && existingData.length > 0 
      ? existingData[0] 
      : ['committeeId', 'committeeName', 'orgId', 'orgCode', 'orgName', 'region', 'role', 'checkType'];

    // 새 매칭 정보 포맷팅
    const newRows = matchings.map(matching => [
      matching.committeeId || '',
      matching.committeeName || '',
      matching.orgId || '',
      matching.orgCode || '',
      matching.orgName || '',
      matching.region || '',
      matching.role || '', // '주담당' 또는 '부담당'
      matching.checkType || '전체' // '매월', '반기', '전체' 중 하나
    ]);

    // 시트에 쓰기
    console.log('위원-기관 매칭 정보 업데이트 중...');
    const dataToWrite = [headers, ...newRows];
    const updateRange = `위원별_담당기관!A1:H${dataToWrite.length}`;
    
    await writeSheetData(SPREADSHEET_ID, updateRange, dataToWrite);
    console.log('위원-기관 매칭 정보 업데이트 완료');
    
    return res.status(200).json({
      status: 'success',
      message: '위원-기관 매칭 정보가 성공적으로 업데이트되었습니다.',
      data: { matchings }
    });
  } catch (error) {
    console.error('위원-기관 매칭 정보 조회 중 오류:', error);
    console.error('[매칭 API 오류 상세 정보]:', JSON.stringify(error) || '상세 정보 없음');
    
    // 에러 객체가 undefined인 경우에도 처리
    const errorObj = error || { message: '알 수 없는 오류' };
    
    // 세부 로그 기록
    if (errorObj.stack) {
      console.error('매칭 API 오류 스택 트레이스:', errorObj.stack);
    }
    
    // 로그에 매칭 API 호출 실패 기록
    console.error('[ERROR] 매칭 API 호출 중 오류:', errorObj.message || '정의되지 않은 에러');
    
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (errorObj.message || '알 수 없는 오류') : undefined
    });
  }
};

module.exports = {
  getAllCommittees,
  getCurrentCommittee,
  getAllCommitteesFromSheet,
  updateCommitteeMatching,
  getAllCommitteeMatchings
}; 