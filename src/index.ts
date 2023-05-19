import dotenv from 'dotenv'
import yahooFinance from 'yahoo-finance2';
import axios from 'axios'
import fs from 'fs'

interface symbolData {
  name: string;
  symbol: string;
  unit: string;
}

interface session {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
}

dotenv.config()

const getYesterday = async () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return getDate(yesterday)
}

const getToday = async () => {
  const today = new Date()
  return getDate(today)
}

const getDate = async (date: Date) => {
  const year = date.getUTCFullYear()
  const month = ('0' + (date.getUTCMonth() + 1)).slice(-2)
  const day = ('0' + date.getUTCDate()).slice(-2)
  return `${year}-${month}-${day}`
}


const run = async () => {

  try {

    const json = await fs.promises.readFile(process.argv[2], 'utf8');
    const symbols: symbolData[] = JSON.parse(json);
    const yesterday: string = await getYesterday()
    const queryOptions = { period1: yesterday, /* ... */ };

    let text: string = ""
    symbols.forEach(async (symbol) => {
      console.log(symbol)
      const results = await yahooFinance.historical(symbol.symbol, queryOptions)
      const yesterdayColose: number = results[0].close
      const todayColose: number = results[1].close
      const diff: number = todayColose - yesterdayColose
      const ratio: number = Math.round(diff / yesterdayColose * 100 * 100) / 100
      text = text + symbol.name + ":終値=" + Math.round(todayColose * 1000) / 1000 + symbol.unit + "(前日比：" + (ratio > 0 ? "+" + ratio : ratio) + "%)"
    })

    const response: any = await axios.post("https://bsky.social/xrpc/com.atproto.server.createSession", {
      identifier: process.env.IDENTIFIER,
      password: process.env.PASSWORD
    })
    const session: session = response.data
    axios.defaults.headers.common['Authorization'] = `Bearer ` + session.accessJwt
    await axios.post("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      collection: "app.bsky.feed.post",
      repo: session.did,
      record: { text: text, createdAt: new Date() }
    })

  } catch (error) {
    console.error(error);
  }
}

const main = async () => {
  await run();
};

main();