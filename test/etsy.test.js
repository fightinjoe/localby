// Script to plug into the web inspector to scrape etsy search results.

// Local search: https://www.etsy.com/c?explicit=1&locationQuery=5391959&ship_to=US&ref=pagination&page=2
const strip = s => s.replace(/^\s+/,'').replace(/\s+$/,'');

const nextText = elt => {
  if( !elt.nextSibling ) return '';
  let text = strip(elt.nextSibling.textContent);
  if( text ) return text;
  return nextText( elt.nextSibling );
};

let prices = Array.from(document.querySelectorAll('.v2-listing-card__info .n-listing-card__price'));

let sellers = [];

prices
  .map( p => {
    let text = nextText(p).split(/\n\s+/);
    return text[ text.length-1 ];;
  })
  .forEach( seller => {
    if( seller.match(/^FREE shipping/) ) return;
    if( !sellers.includes(seller) ) sellers.push(seller);
  });

console.log(sellers.join("\n"));