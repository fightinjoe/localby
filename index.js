// Support for environment variables
import dotenv from 'dotenv';
dotenv.config();

/*== Logging setup ==*/
import chalk from 'chalk';
const ERROR = chalk.bold.red;
const SUCCESS = chalk.bold.green;
const WARNING = chalk.bold.yellow;
const INFO = chalk.bold.blue;

/*== Spreadsheet setup ==*/
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// import creds from './localby-391220-de31717600c1.json' assert { type: 'json' };

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets'
]

const serviceAccountAuth = new JWT({
  email: process.env.CLIENT_EMAIL,
  key: process.env.PRIVATE_KEY,
  scopes: SCOPES,
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

/*== Scraping setup ==*/

import cheerio from 'cheerio';
import axios from 'axios';

const selectors = {
  sellers: {
    _ : "main#content .shop-home > div:first-child",
    username: ".shop-name-and-title-container h1",
    store: ".shop-name-and-title-container p",
    location: ".shop-location span",
    owner: ".shop-owner .img-container p",
    // announcement: "p.announcement-collapse",
    icon_src: "img.shop-icon-external",
    avatar_src: ".shop-owner .img-container img.user-avatar-external",
    banner_src: ".cover-photo-wrap img"
  },
  products: ".v2-listing-card",
  product: {
    // Featured items can take multiple forms, so a generic selector is best
    link_href : "a:first-child",
    img_src : ".v2-listing-card__img img",
    title : ".v2-listing-card__info h3",
    price : ".v2-listing-card__info .currency-value",
  },
  product_details: {
    images: "ul.carousel-pane-list img",
    highlights: "#product-details-content-toggle",
    description: "#product-description-content-toggle p",
  }
}

let productRows, productSheet;
let sellerRows;

async function init() {
  console.log(WARNING("Initializing Etsy screen scraper"));
  
  console.log("Loading spreadsheet...")
  await doc.loadInfo();

  [,sellerRows] = await loadSheetAndRows('Sellers');
  [productSheet,productRows] = await loadSheetAndRows('Products');

  // For each seller row, scrape any data that is missing
  const activeSellerRows = sellerRows.filter( row => row.get('skip') !== 'TRUE' );
  console.log(INFO(`Scraping ${activeSellerRows.length}/${sellerRows.length} sellers.`));
  for( let i = 0; i < activeSellerRows.length; i++ ) {
    const row = activeSellerRows[i];
    await scrapeSeller( row );
    await delay();
  }

  // For each product row, scrape any data that is missing
  const activeProductRows = productRows.filter( row => row.get('skip') !== 'TRUE' );
  console.log(INFO(`Scraping ${activeProductRows.length}/${productRows.length} products.`));
  for( let i=0; i < activeProductRows.length; i++ ) {
    const row = activeProductRows[i];
    await scrapeProduct( row, i );
    await delay()
  }
}

const log = {
  write: (msg) => process.stdout.write(msg),
  rewrite: (msg) => {
    log.delete();
    process.stdout.write(msg);
  },
  delete: () => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
  },
  end: () => process.stdout.write("\n")
}

async function delay( ms ) {
  ms = ms || Math.floor( Math.random() * 2000 ) + 4000;
  // console.log(`Delaying ${ms}ms...`);
  log.write(`Delaying ${ms}ms...`);
  return new Promise( resolve => setTimeout( () => { log.delete(); resolve(); }, ms ) );
}

// Returns the sheet and rows for the given title
async function loadSheetAndRows( title ) {
  const sheet = doc.sheetsByTitle[ title ];
  const rows = await sheet.getRows();

  return [sheet, rows];
}

// Returns the response for the given URL
async function loadURL( url ) {
  try {
    const response = await axios.request({
      method: "GET",
      url: url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
      }
    });

    return cheerio.load(response.data);
  } catch {
    console.log(ERROR(`Error loading URL: ${url}`));

    return false;
  }
}

function findProduct( key, value ) {
  return productRows.find( row => row.get( key ) === value );
}

// Scrapes the seller information from the given row,
// saving the data into the row
async function scrapeSeller( row ) {
  // Skip if the row is marked as "skip"
  if( row.get('skip') === 'TRUE' ) return;
  
  const url = row.get('url');
  // console.log(`Scraping seller: ${url}`);
  log.write(`Scraping seller: ${url}`);

  const $ = await loadURL( url );
  if( !$ ) return;

  const sellerHTML = $( selectors.sellers._ );
  const sellerKeys = Object.keys( selectors.sellers );

  // Pull the data about the seller from the page
  sellerKeys.forEach( key => {
    // Ignore the "_" base selector
    if ( key === "_" ) return;

    const selector = selectors.sellers[ key ];
    // Keys may have a "_attr" suffix, which indicates which
    // attribute to pull the value from
    const attr = key.split('_')[1];
    
    const elt = sellerHTML.find( selector );
    const value = attr
      ? elt.attr( attr )
      : elt.text().trim();

    row.set(key, value);
  } );

  // Manual hack to add announcement text.
  // TODO: find a more generic way to capture items outside the seller's DOM node
  const announcement = $( $("p.announcement-collapse").first());
  row.set('announcement', trimP(announcement.text()));

  row.save();

  // Pull the data about the products from the page
  const productsHTML = $( selectors.products );
  // console.log(`Found ${productsHTML.length} products.`);
  
  log.rewrite(`Scraping seller: ${row.get('username')}, ${ productsHTML.length} products`);
  
  // Array for collecting all of the new products that are found
  let products = [];
  productsHTML.each( (i, product) => {
    try {
      let out = {};
      product = $(product);
      
      let featured = $('.featured-listings');
  
      // check to see if it is favorited
      out.features = hasParent( product, featured );
  
      // capture the other data
      out.username = row.get('username');
      out.link_href = product.find( selectors.product.link_href ).attr("href").split('?')[0];
      out.img_src = product.find( selectors.product.img_src ).attr("src");
      out.title = product.find( selectors.product.title ).text().trim();
      out.price = $(product.find( selectors.product.price )[0]).text().trim();
  
      // check to see if it is already in the list
      // if( out.products.filter( p => p.url === out.url ).length > 0 )  return;
      if( findProduct( 'link_href', out.link_href ) ) return;
  
      if( !out.img_src ) return;

      products.push(out);
    } catch {
      console.log(`Error scraping product #${i}: ${product.text().trim().split("\n")[0]}`);
    }
  });

  log.end();

  await productSheet.addRows( products );
}

async function scrapeProduct( row, i ) {
  // Skip if the row is marked as "skip"
  if( row.get('skip') === 'TRUE' ) return;

  // Once we process the row, set it to skip until it's manually flagged to be scraped
  row.set('skip', 'TRUE');

  const url = row.get('link_href');
  console.log(`[${i}] Scraping product: ${url}`);

  const $ = await loadURL( url );
  if ( !$ ) return;

  const sel = selectors.product_details;
  
  // Pull the description from HTML to preserve the <br> tags
  try { row.set('description', trimP($( sel.description ).html())); } catch {}
  
  // Pull the highlights from the text
  try { row.set('highlights', trimP($( sel.highlights ).text()) ); } catch {}
  
  // Pull the images, up to 7
  try {
    $( sel.images ).each( (i, img) => {
      // the first image uses src="", the subsequent images use data-src=""
      row.set(`img_src_${i}`, $(img).attr('src') || $(img).attr('data-src'));
      row.set(`img_alt_${i}`, $(img).attr('alt'));
    } );
  } catch {
    console.log(ERROR('Failed to find images.'))
  }

  row.save();
}

// Trims whitespace and <br> tags from the given string
function trimP( p ) {
  return p
    .replace(/(<br>)+/g, '\n')
    .split(/\n+/)
    .map( s => s.trim() )
    .filter(s => s)
    .filter(s => !s.match('Read the full list of materials'))
    .join("\n");
}

// Returns a boolean depending on whether or not child is a child of parent
function hasParent( child, parent ) {
  if( child.length === 0 || parent.length === 0 ) {
    console.log(ERROR('hasParent failed because either child or parent is empty.'));
    return false;
  }

  if ( child.get(0).tagName === 'body' ) return false;
  if ( child.get(0).tagName === parent.get(0).tagName &&
       child.attr('class') === parent.attr('class') ) return true;

  return hasParent( child.parent(), parent );
}

init();