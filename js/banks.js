/* Banks and e-wallets people can add, by currency. Colors are approximate brand colors used
   only to tint the card; no logos or card artwork are copied. [id, name, background, accent] */
window.BANKS = (function () {
  'use strict';

  const BY_CURRENCY = {
    PHP: [
      ['bpi', 'BPI', '#b11116', '#f2c94c'],
      ['bdo', 'BDO', '#0033a1', '#fdb913'],
      ['metrobank', 'Metrobank', '#0b3d91', '#c8a24a'],
      ['landbank', 'Landbank', '#00753a', '#f6d14b'],
      ['pnb', 'PNB', '#0a2a66', '#e31837'],
      ['securitybank', 'Security Bank', '#0071bc', '#7ac143'],
      ['unionbank', 'UnionBank', '#f47920', '#ffffff'],
      ['rcbc', 'RCBC', '#004b8d', '#00a3e0'],
      ['chinabank', 'China Bank', '#c8102e', '#ffd100'],
      ['eastwest', 'EastWest', '#6d2077', '#e4a6ff'],
      ['psbank', 'PSBank', '#004c97', '#ffffff'],
      ['aub', 'AUB', '#8a1538', '#d4af37'],
      ['maybank-ph', 'Maybank', '#ffc72c', '#000000'],
      ['cimb-ph', 'CIMB', '#ec1c24', '#ffffff'],
      ['gotyme', 'GoTyme', '#0b2f3a', '#3ee0cf'],
      ['seabank', 'SeaBank', '#ff6b00', '#ffffff'],
      ['tonik', 'Tonik', '#5a2ee0', '#ff6bcb'],
      ['gcash', 'GCash', '#005ce6', '#ffffff'],
      ['maya', 'Maya', '#0b0b0b', '#00d26a'],
      ['shopeepay', 'ShopeePay', '#ee4d2d', '#ffffff'],
      ['coins', 'Coins.ph', '#1652f0', '#ffffff']
    ],
    USD: [
      ['chase', 'Chase', '#117aca', '#ffffff'], ['bofa', 'Bank of America', '#012169', '#e31837'],
      ['wellsfargo', 'Wells Fargo', '#d71e28', '#ffcd41'], ['citi', 'Citi', '#003b70', '#e31837'],
      ['capitalone', 'Capital One', '#004977', '#d03027'], ['usbank', 'U.S. Bank', '#0c2074', '#e31837'],
      ['paypal', 'PayPal', '#003087', '#009cde'], ['venmo', 'Venmo', '#008cff', '#ffffff']
    ],
    SGD: [
      ['dbs', 'DBS', '#e2001a', '#ffffff'], ['posb', 'POSB', '#0b3b8c', '#ffcc00'],
      ['ocbc', 'OCBC', '#e2231a', '#ffffff'], ['uob', 'UOB', '#0b3b8c', '#e2231a'],
      ['sc-sg', 'Standard Chartered', '#0473ea', '#38d200'], ['trust', 'Trust Bank', '#1f1f1f', '#3cff8f']
    ],
    EUR: [
      ['deutsche', 'Deutsche Bank', '#0018a8', '#ffffff'], ['bnp', 'BNP Paribas', '#00965e', '#ffffff'],
      ['ing', 'ING', '#ff6200', '#ffffff'], ['santander-eu', 'Santander', '#ec0000', '#ffffff'],
      ['revolut', 'Revolut', '#191c1f', '#ffffff'], ['n26', 'N26', '#36a18b', '#ffffff']
    ],
    GBP: [
      ['barclays', 'Barclays', '#00aeef', '#ffffff'], ['hsbc-uk', 'HSBC', '#db0011', '#ffffff'],
      ['lloyds', 'Lloyds', '#006a4d', '#ffffff'], ['natwest', 'NatWest', '#42145f', '#ffffff'],
      ['santander-uk', 'Santander', '#ec0000', '#ffffff'], ['monzo', 'Monzo', '#14233c', '#ff4f40'],
      ['revolut-uk', 'Revolut', '#191c1f', '#ffffff']
    ],
    CAD: [
      ['rbc', 'RBC', '#005daa', '#ffd200'], ['td', 'TD', '#008a00', '#ffffff'],
      ['scotiabank', 'Scotiabank', '#ec111a', '#ffffff'], ['bmo', 'BMO', '#0079c1', '#ed1c24'],
      ['cibc', 'CIBC', '#c41f3e', '#ffffff']
    ],
    AUD: [
      ['commbank', 'CommBank', '#ffcc00', '#000000'], ['westpac', 'Westpac', '#d5002b', '#ffffff'],
      ['anz', 'ANZ', '#004165', '#00a1e0'], ['nab', 'NAB', '#000000', '#c20000']
    ],
    NZD: [
      ['anz-nz', 'ANZ', '#004165', '#00a1e0'], ['asb', 'ASB', '#ffcc00', '#000000'],
      ['bnz', 'BNZ', '#0b2a5b', '#ffffff'], ['westpac-nz', 'Westpac', '#d5002b', '#ffffff'],
      ['kiwibank', 'Kiwibank', '#6eb43f', '#ffffff']
    ],
    JPY: [
      ['mufg', 'MUFG', '#e60012', '#ffffff'], ['smbc', 'SMBC', '#004831', '#b5c800'],
      ['mizuho', 'Mizuho', '#002c8b', '#e60012'], ['jpbank', 'Japan Post Bank', '#008a3e', '#ffffff'],
      ['rakuten', 'Rakuten Bank', '#bf0000', '#ffffff']
    ],
    KRW: [
      ['kb', 'KB Kookmin', '#ffbc00', '#5f5045'], ['shinhan', 'Shinhan', '#0046ff', '#ffffff'],
      ['hana', 'Hana Bank', '#008c8c', '#e5003a'], ['woori', 'Woori Bank', '#0067ac', '#00b0e6'],
      ['kakaobank', 'KakaoBank', '#ffe300', '#3c1e1e']
    ],
    CNY: [
      ['icbc', 'ICBC', '#c7000b', '#ffffff'], ['ccb', 'CCB', '#0066b3', '#ffffff'],
      ['abc', 'Agricultural Bank of China', '#008f6b', '#ffffff'], ['boc', 'Bank of China', '#b81c22', '#ffffff'],
      ['alipay', 'Alipay', '#1677ff', '#ffffff']
    ],
    HKD: [
      ['hsbc-hk', 'HSBC', '#db0011', '#ffffff'], ['hangseng', 'Hang Seng', '#00847f', '#ffffff'],
      ['bochk', 'BOC Hong Kong', '#b81c22', '#ffffff'], ['sc-hk', 'Standard Chartered', '#0473ea', '#38d200']
    ],
    INR: [
      ['sbi', 'SBI', '#22409a', '#00b5ef'], ['hdfc', 'HDFC Bank', '#004c8f', '#ed232a'],
      ['icici', 'ICICI Bank', '#ae282e', '#f58220'], ['axis', 'Axis Bank', '#97144d', '#ffffff']
    ],
    IDR: [
      ['bca', 'BCA', '#0060af', '#ffffff'], ['mandiri', 'Mandiri', '#003d79', '#ffb700'],
      ['bri', 'BRI', '#00529c', '#f37021'], ['bni', 'BNI', '#f15a23', '#005e6a']
    ],
    MYR: [
      ['maybank-my', 'Maybank', '#ffc72c', '#000000'], ['cimb-my', 'CIMB', '#ec1c24', '#ffffff'],
      ['publicbank', 'Public Bank', '#d6001c', '#ffffff'], ['rhb', 'RHB', '#0067b1', '#ffffff'],
      ['hongleong', 'Hong Leong Bank', '#00205c', '#e1251b']
    ],
    THB: [
      ['bangkokbank', 'Bangkok Bank', '#1e4598', '#ffffff'], ['kbank', 'Kasikornbank', '#138f2d', '#ffffff'],
      ['scb', 'SCB', '#4e2e7f', '#d4a74f'], ['krungthai', 'Krungthai', '#00a6e6', '#ffffff']
    ],
    VND: [
      ['vietcombank', 'Vietcombank', '#007a3d', '#ffffff'], ['techcombank', 'Techcombank', '#e31837', '#ffffff'],
      ['bidv', 'BIDV', '#006b68', '#ffd200'], ['vietinbank', 'VietinBank', '#004a8f', '#e31837']
    ],
    AED: [
      ['enbd', 'Emirates NBD', '#072e5c', '#f58220'], ['fab', 'First Abu Dhabi Bank', '#0e2a47', '#ffffff'],
      ['adcb', 'ADCB', '#e31837', '#ffffff'], ['mashreq', 'Mashreq', '#f15a22', '#ffffff']
    ],
    SAR: [
      ['alrajhi', 'Al Rajhi Bank', '#0b2fa0', '#ffffff'], ['snb', 'SNB', '#00704a', '#ffffff'],
      ['riyad', 'Riyad Bank', '#00205b', '#c8a24a']
    ],
    ZAR: [
      ['standardbank', 'Standard Bank', '#0033a1', '#ffffff'], ['fnb', 'FNB', '#009999', '#f9a51a'],
      ['absa', 'Absa', '#dc0032', '#ffffff'], ['capitec', 'Capitec', '#00266c', '#e2001a'],
      ['nedbank', 'Nedbank', '#006341', '#ffffff']
    ],
    BRL: [
      ['itau', 'Itaú', '#ec7000', '#003399'], ['bradesco', 'Bradesco', '#cc092f', '#ffffff'],
      ['bb', 'Banco do Brasil', '#fcfc30', '#0038a8'], ['nubank', 'Nubank', '#820ad1', '#ffffff'],
      ['caixa', 'Caixa', '#005ca9', '#f39200']
    ],
    MXN: [
      ['bbva-mx', 'BBVA México', '#004481', '#1973b8'], ['banorte', 'Banorte', '#eb0029', '#ffffff'],
      ['santander-mx', 'Santander', '#ec0000', '#ffffff'], ['banamex', 'Banamex', '#002e6d', '#ffffff']
    ],
    CHF: [
      ['ubs', 'UBS', '#e60000', '#ffffff'], ['postfinance', 'PostFinance', '#ffcc00', '#000000'],
      ['raiffeisen', 'Raiffeisen', '#000000', '#ffd200']
    ],
    SEK: [
      ['swedbank', 'Swedbank', '#ee7023', '#ffffff'], ['seb', 'SEB', '#60cd18', '#000000'],
      ['handelsbanken', 'Handelsbanken', '#005ba7', '#ffffff'], ['nordea-se', 'Nordea', '#0000a0', '#ffffff']
    ],
    NOK: [
      ['dnb', 'DNB', '#007272', '#ffffff'], ['nordea-no', 'Nordea', '#0000a0', '#ffffff'],
      ['sparebank1', 'SpareBank 1', '#002776', '#e40046']
    ],
    DKK: [
      ['danske', 'Danske Bank', '#003755', '#ffffff'], ['nordea-dk', 'Nordea', '#0000a0', '#ffffff'],
      ['jyske', 'Jyske Bank', '#006e46', '#ffffff']
    ],
    PLN: [
      ['pkobp', 'PKO BP', '#003574', '#ffffff'], ['pekao', 'Pekao', '#d8282f', '#ffffff'],
      ['mbank', 'mBank', '#c4161c', '#ffffff'], ['santander-pl', 'Santander', '#ec0000', '#ffffff']
    ]
  };
  const GENERIC = [
    ['cash', 'Cash', '#2f6f4f', '#d9f2c4'],
    ['other', 'Other bank', '#272635', '#b1e5f2']
  ];

  function make(row) { return { id: row[0], name: row[1], color: row[2], accent: row[3] }; }

  /** Banks for a currency, with Cash and "Other bank" at the end. */
  function forCurrency(currency) {
    return (BY_CURRENCY[currency] || []).concat(GENERIC).map(make);
  }

  /** Finds a bank by id in any country, so cards still look right after a currency change. */
  function find(id) {
    for (const key in BY_CURRENCY) {
      const row = BY_CURRENCY[key].find(function (r) { return r[0] === id; });
      if (row) return make(row);
    }
    const g = GENERIC.find(function (r) { return r[0] === id; });
    return make(g || GENERIC[1]);
  }

  /** Dark or light text, whichever reads better on the color. */
  function inkOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.6 ? '#111111' : '#ffffff';
  }

  return { forCurrency: forCurrency, find: find, inkOn: inkOn };
})();
