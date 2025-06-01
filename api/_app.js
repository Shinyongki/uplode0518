// Express 앱을 Vercel 서버리스 함수로 처리하는 공통 래퍼
const app = require('./index.js');

module.exports = (req, res) => {
  // Express 앱으로 요청을 전달
  return app(req, res);
}; 