const axios = require('axios');

const API_KEY = 'rYHS8ask773BaSb7o4HbuwkRT2EMjbFb';

const urls = [
  'https://financialmodelingprep.com/stable/sp500-constituent?apikey=' + API_KEY,
  'https://financialmodelingprep.com/api/v3/sp500_constituent?apikey=' + API_KEY,
  'https://financialmodelingprep.com/api/v3/sp500-constituent?apikey=' + API_KEY,
  'https://financialmodelingprep.com/stable/sp500_constituent?apikey=' + API_KEY,
  'https://financialmodelingprep.com/api/v3/stock-screener?marketCapMoreThan=10000000000&limit=500&apikey=' + API_KEY,
];

async function testAll() {
  for (const url of urls) {
    try {
      const res = await axios.get(url);
      console.log(`SUCCESS [${res.status}]: ${url.split('?')[0]} -> Array length: ${Array.isArray(res.data) ? res.data.length : 'not array'}, sample item:`, Array.isArray(res.data) ? res.data[0] : res.data);
    } catch (err) {
      console.log(`FAILED [${err.response ? err.response.status : err.message}]: ${url.split('?')[0]}`);
      if (err.response && err.response.data) {
        console.log(`   Response data:`, JSON.stringify(err.response.data).slice(0, 200));
      }
    }
  }
}

testAll();
