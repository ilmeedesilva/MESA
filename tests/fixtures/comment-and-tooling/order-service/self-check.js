const axios = require('axios');

async function waitUntilHealthy() {
  await axios.get('http://order-service:8080/health');
}

module.exports = { waitUntilHealthy };
