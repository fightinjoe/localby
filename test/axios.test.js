const cheerio = require("cheerio")
const axios = require("axios")

const url = "https://www.etsy.com/shop/jasonstropko?ref=shop-header-name&listing_id=252427545";

let out = {
  store: {
    username: "",
    store: "",
    location: "",
    owner: "",
    avatar: "",
    banner: "",
    icon: ""
  },
  products: []
};

let lookup = {
  store: {
    _ : "main#content .shop-home > div:first-child",
    username: ".shop-name-and-title-container h1",
    store: ".shop-name-and-title-container p",
    location: ".shop-location span",
    owner: ".shop-owner .img-container p",
    _img : {
      icon: "img.shop-icon-external",
      avatar: ".shop-owner .img-container img.user-avatar-external",
      banner: ".cover-photo-wrap img"
    }
  },
  products: ".v2-listing-card",
  product: {
    url : "a.listing-link",
    img : ".v2-listing-card__img img",
    title : ".v2-listing-card__info h3",
    price : ".v2-listing-card__info .currency-value",
  }
}

async function performScraping() {
    // downloading the target web page
    // by performing an HTTP GET request in Axios
    const response = await axios.request({
        method: "GET",
        url: url,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        }
    })

    // parsing the HTML source of the target web page with Cheerio
    const $ = cheerio.load(response.data)

    scrapeStore($);
    scrapeProducts($);

    console.log( out );
}

function scrapeStore( $ ) {
  console.log('Scraping store data...');
  const storeHTML = $( lookup.store._ );
  const storeKeys = Object.keys(lookup.store);

  storeKeys.forEach( k => {
    if ( k.match(/^_/) ) return;

    out.store[k] = storeHTML.find( lookup.store[k] ).text().trim();
  });

  const srcKeys = Object.keys(lookup.store._img);
  srcKeys.forEach( k => {
    out.store[k] = storeHTML.find( lookup.store._img[k] ).attr("src");
  });
}

// Returns a boolean depending on whether or not child is a child of parent
function hasParent( child, parent ) {
  if( child.length === 0 || parent.length === 0 ) {
    console.log('hasParent failed because either child or parent is empty.');
    return false;
  }

  if ( child.get(0).tagName === 'body' ) return false;
  if ( child.get(0).tagName === parent.get(0).tagName &&
       child.attr('class') === parent.attr('class') ) return true;

  return hasParent( child.parent(), parent );
}

function scrapeProducts( $ ) {
  console.log('Scraping products data...');
  const productsHTML = $( lookup.products );
  
  productsHTML.each( (i, product) => {
    let pOut = {};
    product = $(product);
    
    let featured = $('.featured-listings');

    // check to see if it is favorited
    pOut.features = hasParent( product, featured );

    // capture the other data
    pOut.url = product.find( lookup.product.url ).attr("href").split('?')[0];
    pOut.img = product.find( lookup.product.img ).attr("data-src");
    pOut.title = product.find( lookup.product.title ).text().trim();
    pOut.price = product.find( lookup.product.price ).text().trim();

    // check to see if it is already in the list
    if( out.products.filter( p => p.url === pOut.url ).length > 0 )  return;

    console.log(`Found product: "${pOut.title}"`);
    out.products.push( pOut );
  })
}

performScraping();