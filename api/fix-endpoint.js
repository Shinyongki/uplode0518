// 기관 목록 API 엔드포인트
app.get('/api/organizations', async (req, res) => {
  try {
    console.log('[API] /api/organizations 요청 받음');
    
    // 기관 데이터 저장 배열
    const organizations = [];
    
    // 구글 시트에서 기관 목록 가져오기
    const sheetsHelper = new SheetsHelper();
    await sheetsHelper.authorize();
    
    console.log('[API] 구글 시트에서 데이터 로드 시도...');
    
    try {
      // 기관_목록 시트에서 기관 목록 가져오기
      const orgListData = await sheetsHelper.readSheet('기관_목록');
      console.log(`[API] 기관 목록 데이터 ${orgListData.length}개 행 로드 완료`);
      
      // 위원별_담당기관 시트에서 매칭 데이터 가져오기
      const matchingData = await sheetsHelper.readSheet('위원별_담당기관');
      console.log(`[API] 위원별 담당기관 데이터 ${matchingData.length}개 행 로드 완료`);
      
      // 기관 목록 시트에서 데이터 추출 (헤더 제외)
      if (orgListData && orgListData.length > 1) {
        for (let i = 1; i < orgListData.length; i++) {
          const row = orgListData[i];
          if (row && row.length >= 2) { // 최소한 기관코드와 이름이 있는지 확인
            organizations.push({
              code: row[0] || '',      // 기관코드
              name: row[1] || '',      // 기관명
              region: row[2] || '',    // 지역
              address: row[3] || '',   // 주소
              phone: row[4] || '',     // 연락처
              manager: row[5] || '',   // 담당자
              notes: row[6] || ''      // 비고
            });
          }
        }
      }
      
      // 매칭 정보 데이터 추가
      if (matchingData && matchingData.length > 1) {
        // 기관코드별 매칭 정보 구성
        const matchingMap = {};
        
        for (let i = 1; i < matchingData.length; i++) {
          const row = matchingData[i];
          if (row && row.length >= 4) {
            const orgCode = row[0];
            const committeeName = row[2] || '';
            const role = row[6] || '';
            
            if (!matchingMap[orgCode]) {
              matchingMap[orgCode] = {
                mainCommittee: '',
                subCommittees: []
              };
            }
            
            // 주담당 또는 부담당에 따라 처리
            if (role === '주담당') {
              matchingMap[orgCode].mainCommittee = committeeName;
            } else if (role === '부담당') {
              matchingMap[orgCode].subCommittees.push(committeeName);
            }
          }
        }
        
        // 매칭 정보를 기관 데이터에 추가
        organizations.forEach(org => {
          const matchInfo = matchingMap[org.code];
          if (matchInfo) {
            org.mainCommittee = matchInfo.mainCommittee;
            org.subCommittees = matchInfo.subCommittees.join(', ');
          } else {
            org.mainCommittee = '';
            org.subCommittees = '';
          }
        });
      }
    } catch (sheetError) {
      console.error('[API] 구글 시트 데이터 가져오기 실패:', sheetError);
      console.log('[API] 대체 데이터 사용');
      
      // 하드코딩된 대체 데이터
      organizations.push(
        { code: 'A48120002', name: '창원도우누리노인통합재가센터', region: '창원시', mainCommittee: '신용기', subCommittees: '김수연' },
        { code: 'A48740002', name: '창녕군새누리노인통합지원센터', region: '창녕군', mainCommittee: '문일지', subCommittees: '이연숙' }
      );
    }
    
    console.log(`[API] 총 ${organizations.length}개의 기관 데이터 반환`);
    
    // 클라이언트가 기대하는 형식으로 데이터 반환
    res.status(200).json({
      status: 'success',
      organizations: {
        main: organizations,
        sub: []
      }
    });
  } catch (error) {
    console.error('[API] 기관 목록 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});
