module.exports = (req, res) => {
  return res.status(200).json({
    status: 'success',
    data: { 
      organizations: [
        { code: 'A001', name: '테스트기관1', region: '서울' },
        { code: 'A002', name: '테스트기관2', region: '부산' },
        { code: 'A003', name: '테스트기관3', region: '대구' },
        { code: 'A004', name: '테스트기관4', region: '인천' },
        { code: 'A005', name: '테스트기관5', region: '광주' },
        { code: 'A006', name: '테스트기관6', region: '대전' }
      ] 
    }
  });
}; 