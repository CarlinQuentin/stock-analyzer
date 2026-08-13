const axios = require('axios');

const API_KEY = 'rYHS8ask773BaSb7o4HbuwkRT2EMjbFb';

async function testBatchQuotes() {
  // Fetch top 50 symbols from screener
  const screenerRes = await axios.get(`https://financialmodelingprep.com/stable/company-screener?exchange=NASDAQ,NYSE,AMEX&country=US&isEtf=false&isActivelyTrading=true&limit=50&apikey=${API_KEY}`);
  const symbols = screenerRes.data.map(i => i.symbol);

  console.log(`Fetched ${symbols.length} symbols from screener`);

  console.time('Batch fetch 50 quotes');
  const quotePromises = symbols.map(sym => 
    axios.get(`https://financialmodelingprep.com/stable/quote?symbol=${sym}&apikey=${API_KEY}`)
      .then(res => res.data && res.data[0] ? res.data[0] : null)
      .catch(() => null)
  );

  const quotes = (await Promise.all(quotePromises)).filter(Boolean);
  console.timeEnd('Batch fetch 50 quotes');
  console.log(`Successfully fetched ${quotes.length} quotes!`);
  console.log('Sample quote:', quotes[0]);
}

testBatchQuotes();
