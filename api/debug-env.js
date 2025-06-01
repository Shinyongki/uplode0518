module.exports = (req, res) => {
  try {
    return res.status(200).json({
      status: 'success',
      data: {
        nodeVersion: process.version,
        useServiceAccount: process.env.USE_SERVICE_ACCOUNT,
        spreadsheetIdExists: !!process.env.SPREADSHEET_ID,
        clientEmailExists: !!process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
        privateKeyExists: !!process.env.SERVICE_ACCOUNT_PRIVATE_KEY
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}; 