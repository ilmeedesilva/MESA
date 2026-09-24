module.exports = {
  beforeEach: function (transaction, done) {
    transaction.request.headers['X-Mock'] = process.env.MOCK_ENDPOINT || 'http://orders-mock:9999/api';
    done();
  }
};
