const axios = require('axios');
const API_KEY = 'rYHS8ask773BaSb7o4HbuwkRT2EMjbFb';

async function inspectScreener() {
  const res = await axios.get(`https://financialmodelingprep.com/stable/company-screener?exchange=NASDAQ,NYSE,AMEX&country=US&isEtf=false&isActivelyTrading=true&limit=500&apikey=${API_KEY}`);
  console.log('Item count:', res.data.length);
  console.log('Item keys:', Object.keys(res.data[0]));
  console.log('Sample item 0:', res.data[0]);
  console.log('Sample item 1:', res.data[1]);
}

inspectScreener();
