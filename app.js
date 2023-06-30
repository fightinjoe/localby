let sellers = [];
let products = [];

const start = () => {
  gapi.client.init({
    'apiKey': 'AIzaSyBUCmrkE6kPJ5grdG43FScIgSHeSzLv9-s',
    'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  })
  .then(() => {
    return gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: '1qfbSmmqmdos5-VcW5sOFn7Js-TGNmSGT0gxmCNHPcTs',
      range: 'Sellers!B2:J',
    })
  })
  .then((response) => {
    sellers = response.result.values;
    return gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: '1qfbSmmqmdos5-VcW5sOFn7Js-TGNmSGT0gxmCNHPcTs',
      range: 'Products!B2:V',
    })
  })
  .then((response) => {
    products = response.result.values;

    // compose the products with the sellers
    sellers = sellers.map( seller => {
      seller.products = products.filter( product => product[0] === seller[1] );
      return seller;
    })

    // print the sellers
    sellers.forEach( seller => printSeller(seller) );

  }).catch((err) => {
    console.log('Error', err);
  });
}

const printSeller = (seller) => {

  const [url, username, store, location, owner, announcement, avatar_src, banner_src, icon_src] = seller;

  // const html = `
  //   <div class="product">
  //     <img src="${ img_src}" alt="${ description }">
  //     <div class="description">
  //       <h1>
  //         <a href="${ link_href }" target="_blank">
  //           ${ title }
  //         </a>
  //       </h1>
  //       <a class="seller" href="${ url }" target="_blank">
  //         <img src="${ avatar_src}" alt="${ owner }">
  //         <span>${ store }</span>
  //       </a>
  //       <span class="price">${ price }</span>
  //     </div>
  //   </div>
  // `

  const html2 = `
    <div class="seller v2">
      
      <div class="avatar">
        <a href="${ url }" target="_blank">
          <img src="${ avatar_src}" alt="${ owner }">
          <div class="store">
            <span>${ owner } <small>${ username }</small></span>
            <span>${ store }</span>
          </div>
          <div class="summary">
            <span>${ seller.products.length } products</span>
            <span>${ location }</span>
          </div>
        </a>
      </div>

      <ul class="products">
        ${ seller.products.map( product => printProduct(product) ).join('') }
      </ul>
    </div>
  `

  document.querySelector('#sellers').innerHTML += html2;
}

const printProduct = (product) => {
  const [, link_href, img_src, title, price, description, highlights] = product;

  return `
    <li class="product">
      <a href="${ link_href }" target="_blank">
        <img src="${ img_src}">
        <div class="description">
          <h1>${ title }</h1>
          <span class="price">${ price }</span>
        </div>
      </a>
    </li>
  `
}

