import dotenv from 'dotenv';
import yahooFinance from 'yahoo-finance2';
import axios from 'axios';
import fs from 'fs';
import alphavantage from 'alphavantage';

type Stock = {
  name: string;
  symbol: string;
  unit: string;
  format: string;
};

type Currency = {
  name: string;
  fromCode: string;
  toCode: string;
  unit: string;
  format: string;
};

interface Session {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
}

dotenv.config();

const getBefore7day = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 7);
  return getDate(yesterday);
};

const getToday = () => {
  const today = new Date();
  return getDate(today);
};

const getDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + date.getUTCDate()).slice(-2);
  return `${year}-${month}-${day}`;
};

const fetchYahooFinance = async (symbols: Stock[]) => {
  const before7day: string = await getBefore7day()
  const queryOptions = { period1: before7day, /* ... */ };

  let texts: string[] = [];
  symbols.forEach(async (symbol) => {
    console.log(symbol)
    const results = await yahooFinance.historical(symbol.symbol, queryOptions)
    console.log(results)
    const yesterdayColose: number = results[0].close
    const todayColose: number = results[1].close
    const diff: number = todayColose - yesterdayColose
    const ratio: number = Math.round(diff / yesterdayColose * 100 * 100) / 100
    const text: string = symbol.format.replace("{0}", (Math.round(todayColose * 1000) / 1000).toString()).replace("{1}", (ratio > 0 ? "+" + ratio : ratio).toString())
    console.log(text)
    texts.push(text)
  })
}

const fetchAlphaVantageExchange = async (symbols: Currency[]) => {
  let texts: string[] = [];
  const alpha = alphavantage({ key: process.env.APIKEY ? process.env.APIKEY : '' });

  for (const symbol of symbols) {
    const data: any = await alpha.forex.rate(symbol.fromCode, symbol.toCode);
    const rate = data['Realtime Currency Exchange Rate']['5. Exchange Rate'];
    const text = symbol.format.replace('{0}', (Math.round(rate * 1000) / 1000).toString());
    texts.push(text);
  }

  return texts;
};

const run = async () => {
  try {
    let texts: string[] = [];

    if ('exchange' === process.argv[2]) {
      const json = fs.readFileSync(process.argv[3], 'utf8');
      const symbols: Currency[] = JSON.parse(json);
      texts = await fetchAlphaVantageExchange(symbols);
    } else {
      const json = fs.readFileSync(process.argv[3], 'utf8');
      const symbols: Currency[] = JSON.parse(json);

    }
    //    post(texts)
    console.log(texts)
  } catch (error) {
    console.error(error);
  }
};

const post = async (texts: string[]) => {
  let contents = '';
  for (const text of texts) {
    contents += text;
  }
  if ('' === contents) {
    return;
  }
  try {
    const response: any = await axios.post('https://bsky.social/xrpc/com.atproto.server.createSession', {
      identifier: process.env.IDENTIFIER,
      password: process.env.PASSWORD,
    });

    const session: Session = response.data;
    axios.defaults.headers.common['Authorization'] = `Bearer ` + session.accessJwt;
    await axios.post('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      collection: 'app.bsky.feed.post',
      repo: session.did,
      record: { text: contents, createdAt: new Date() },
    });
  } catch (error) {
    console.error(error);
  }
};

const main = async () => {
  try {
    await run();
  } catch (e) {
    console.log(e);
  }
};

main();
