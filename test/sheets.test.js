// import { GoogleSpreadsheet } from 'google-spreadsheet';
// import { JWT } from 'google-auth-library';

// import creds from './localby-391220-de31717600c1.json';

console.log('Running sheets.test.js');

const GoogleSpreadsheet = require('google-spreadsheet').GoogleSpreadsheet;
const JWT = require('google-auth-library').JWT;

const creds = require('../localby-391220-de31717600c1.json');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets'
]

const serviceAccountAuth = new JWT({
  // env var values here are copied from service account credentials generated by google
  // see "Authentication" section in docs for more info
  email: creds.client_email, //process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: creds.private_key, // process.env.GOOGLE_PRIVATE_KEY,
  scopes: SCOPES,
});

const id = "1qfbSmmqmdos5-VcW5sOFn7Js-TGNmSGT0gxmCNHPcTs";

const doc = new GoogleSpreadsheet(id, serviceAccountAuth);

async function readSpreadsheet() {
  await doc.loadInfo();

  console.log(doc.title);

  const sellers = doc.sheetsByTitle['Sellers'];
  const rows = await sellers.getRows();

  console.log(rows[0].get('username'), rows[0].get('skip') == 'TRUE' );
  console.log(rows[1].get('username'), rows[1].get('skip') == 'TRUE' );

  // rows[0].assign({username: 'baz'});
  // await sellers.saveUpdatedCells();

  // console.log( rows.find( row => row.get('username') === 'jasonstropko') ? true : false );
  // console.log( rows.find( row => row.get('username') === 'jasonstropkoa') ? true : false );
}

readSpreadsheet();