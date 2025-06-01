module.exports = (req, res) => {
  return res.status(200).json({
    status: 'success',
    data: { 
      committees: [
        { id: 1, name: '김위원', role: 'member', region: '서울' },
        { id: 2, name: '이위원', role: 'member', region: '부산' },
        { id: 3, name: '박위원', role: 'member', region: '대구' },
        { id: 4, name: '최위원', role: 'member', region: '인천' },
        { id: 5, name: '마스터', role: 'master', region: '전국' }
      ] 
    }
  });
}; 