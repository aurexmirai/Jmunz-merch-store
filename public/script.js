const $ = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>[...p.querySelectorAll(s)];

const track = $('.stage-track');
const stages = $$('.stage');
const totalStages = stages.length;
let stageIndex = 0;
let locked = false;
let touchStartX = 0;
let productIndex = 0;
let cart = [];

// Preloader
let load = 0;
const loader = setInterval(()=>{
  load = Math.min(100, load + Math.ceil(Math.random()*11));
  $('.load-track i').style.width = load+'%';
  $('.load-percent').textContent = load+'%';
  if(load>=100){clearInterval(loader);setTimeout(()=>$('.preloader').classList.add('done'),450)}
},90);

// Subtle grain texture
const canvas = $('#grain'), ctx = canvas.getContext('2d');
function grain(){
  const dpr=Math.min(devicePixelRatio||1,1.5);
  canvas.width=innerWidth*dpr; canvas.height=innerHeight*dpr;
  const img=ctx.createImageData(canvas.width,canvas.height);
  for(let i=0;i<img.data.length;i+=4){const v=Math.random()*255;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=35}
  ctx.putImageData(img,0,0);
}
grain(); addEventListener('resize',grain);

addEventListener('pointermove',e=>{const p=$('.pointer');p.style.left=e.clientX+'px';p.style.top=e.clientY+'px'});

function goToStage(index){
  index=Math.max(0,Math.min(totalStages-1,index));
  if(index===stageIndex && stages[index].classList.contains('active')) return;
  stageIndex=index;
  track.style.transform=`translate3d(-${stageIndex*(100/totalStages)}%,0,0)`;
  stages.forEach((s,i)=>s.classList.toggle('active',i===stageIndex));
  $('.chapter-name').textContent=stages[stageIndex].dataset.title;
  $('.step-current').textContent=String(stageIndex).padStart(2,'0');
  $('.progress i').style.width=`${stageIndex/(totalStages-1)*100}%`;
  document.documentElement.style.setProperty('--active-accent',stages[stageIndex].dataset.accent);
  locked=true;setTimeout(()=>locked=false,1050);
}

$('.start-button').addEventListener('click',()=>goToStage(1));
$('.nav-next').addEventListener('click',()=>goToStage(stageIndex+1));
$('.nav-prev').addEventListener('click',()=>goToStage(stageIndex-1));

addEventListener('wheel',e=>{
  if($('.cart-panel').classList.contains('open')||$('.menu-panel').classList.contains('open')||$('.catalog-panel').classList.contains('open')||$('.checkout-panel').classList.contains('open')||locked) return;
  if(Math.abs(e.deltaY)+Math.abs(e.deltaX)<20) return;
  goToStage(stageIndex+(e.deltaY+e.deltaX>0?1:-1));
},{passive:true});
addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='ArrowDown')goToStage(stageIndex+1);
  if(e.key==='ArrowLeft'||e.key==='ArrowUp')goToStage(stageIndex-1);
  if(e.key==='Escape'){closeCart();closeMenu();closeCatalog();closeCheckout()}
});
addEventListener('touchstart',e=>touchStartX=e.touches[0].clientX,{passive:true});
addEventListener('touchend',e=>{if($('.catalog-panel').classList.contains('open'))return;const d=e.changedTouches[0].clientX-touchStartX;if(Math.abs(d)>45)goToStage(stageIndex+(d<0?1:-1))},{passive:true});

// Magnetic buttons
$$('.magnetic').forEach(btn=>{
  btn.addEventListener('pointermove',e=>{const r=btn.getBoundingClientRect();btn.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.1}px,${(e.clientY-r.top-r.height/2)*.1}px)`});
  btn.addEventListener('pointerleave',()=>btn.style.transform='');
});

// Sound UI (visual only)
$('.sound-toggle').addEventListener('click',e=>e.currentTarget.classList.toggle('on'));

// Color lab
const colorNames={'#d9ef55':'ACID LIME','#ff6c3a':'FACTORY ORANGE','#62c7df':'ELECTRIC BLUE','#ef746d':'REACTION CORAL','#f3efe3':'RAW CREAM','#173f31':'DEEP GREEN'};
$('.liquid').style.background='#4fa8ff';
$$('.swatch').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.swatch').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  const color=btn.dataset.color;
  $('.shirt-color').style.background=color;$('.color-name').textContent=colorNames[color];
}));

// Print station
$$('.design-chip').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.design-chip').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  $('.selected-print').innerHTML=btn.dataset.print;
}));

// Embroidery unit
$$('.patch-chip').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.patch-chip').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  $('.selected-patch').textContent=btn.dataset.patch;$('.pattern-code').textContent=btn.dataset.code;
}));

$('.pack-button').addEventListener('click',()=>{showToast('ORDER PACKED — READY TO SHIP');setTimeout(()=>goToStage(5),600)});

// Product carousel
let backendProducts = [];
let backendSettings = {};

async function fetchStoreData() {
  try {
    const pRes = await fetch('/api/products');
    backendProducts = await pRes.json();
    const sRes = await fetch('/api/settings');
    backendSettings = await sRes.json();
    applySettings();
    renderDynamicProducts();
  } catch (err) {
    console.error('Failed to load store data', err);
  }
}

function applySettings() {
  if (backendSettings.storeName) {
    document.title = backendSettings.storeName;
    const logoTexts = $$('.factory-logo span, .catalog-brand span');
    logoTexts.forEach(el => el.innerHTML = backendSettings.storeName.replace(/ /g, '<br/>'));
  }
  if (backendSettings.heroTitle) $('.intro-copy h1').innerHTML = backendSettings.heroTitle.replace(/\\n/g, '<br/>');
  if (backendSettings.heroSubtitle) $('.intro-copy p').textContent = backendSettings.heroSubtitle;
  
  if (backendSettings.youtubeUrl) {
    $$('.youtube-channel-link').forEach(a => a.href = backendSettings.youtubeUrl);
  }
  if (backendSettings.officialStoreUrl) {
    const sLink = $('.catalog-footer a');
    if(sLink) sLink.href = backendSettings.officialStoreUrl;
  }
}

function renderDynamicProducts() {
  const carousel = $('.product-carousel');
  const catalog = $('.catalog-grid');
  if(!carousel || !catalog) return;

  carousel.innerHTML = backendProducts.map((p, i) => `
    <article class="factory-product ${i === productIndex ? 'active' : ''}" data-name="${p.name}" data-price="${p.price}">
      <div class="product-index">${String(i + 1).padStart(2,'0')} / ${String(backendProducts.length).padStart(2,'0')}</div>
      <div class="product-stage photo">
        <div class="product-badge">STORE ITEM</div>
        <img alt="${p.name}" class="product-photo" src="${p.image}"/>
      </div>
      <div class="product-meta"><div><h3>${p.name.toUpperCase()}</h3><p>${p.description}</p></div><strong>$${p.price.toFixed(2)}</strong></div>
      <button class="add-product">ADD TO CART <b>＋</b></button>
    </article>
  `).join('');

  catalog.innerHTML = backendProducts.map((p, i) => `
    <article class="catalog-card" data-category="${p.category || 'other'}" data-name="${p.name}" data-price="${p.price}">
      <div class="catalog-image-wrap">
        <span class="catalog-number">${String(i + 1).padStart(2,'0')}</span>
        <span class="catalog-type">${(p.category||'').toUpperCase()}</span>
        <img alt="${p.name}" loading="lazy" src="${p.image}"/>
      </div>
      <div class="catalog-card-info">
        <div><h3>${p.name}</h3><p>${p.description}</p></div>
        <strong>$${p.price.toFixed(2)}</strong>
      </div>
      <button class="catalog-add" type="button">ADD TO CART <b>＋</b></button>
    </article>
  `).join('');

  bindProductListeners();
}

function renderProduct() {
  $$('.factory-product').forEach((p, i) => p.classList.toggle('active', i === productIndex));
}

function bindProductListeners() {
  $$('.add-product').forEach(btn => btn.addEventListener('click', () => {
    const card = btn.closest('.factory-product');
    cart.push({name: card.dataset.name, price: +card.dataset.price});
    renderCart();
    showToast('ADDED TO FACTORY CART');
  }));

  $$('.catalog-add').forEach(btn => btn.addEventListener('click', () => {
    const card = btn.closest('.catalog-card');
    cart.push({name: card.dataset.name, price: +card.dataset.price});
    renderCart();
    showToast('ADDED TO FACTORY CART');
    btn.innerHTML = 'ADDED <b>✓</b>';
    setTimeout(() => btn.innerHTML = 'ADD TO CART <b>＋</b>', 1100);
  }));

  const counts = { all: backendProducts.length, hoodie: 0, tee: 0, accessory: 0 };
  backendProducts.forEach(p => { if(counts[p.category]!==undefined) counts[p.category]++ });
  $$('.catalog-filter').forEach(btn => {
    const f = btn.dataset.filter;
    if(counts[f]!==undefined) btn.querySelector('span').textContent = String(counts[f]).padStart(2,'0');
  });
}

$('.product-next').addEventListener('click', () => { 
  if (backendProducts.length === 0) return;
  productIndex = (productIndex + 1) % backendProducts.length; 
  renderProduct(); 
});
$('.product-prev').addEventListener('click', () => { 
  if (backendProducts.length === 0) return;
  productIndex = (productIndex - 1 + backendProducts.length) % backendProducts.length; 
  renderProduct(); 
});

fetchStoreData();

// Cart
const cartPanel=$('.cart-panel'), overlay=$('.overlay');
function openCart(){cartPanel.classList.add('open');overlay.classList.add('open');cartPanel.setAttribute('aria-hidden','false')}
function closeCart(){cartPanel.classList.remove('open');overlay.classList.remove('open');cartPanel.setAttribute('aria-hidden','true')}
$('.cart-trigger').addEventListener('click',openCart);$('.cart-close').addEventListener('click',closeCart);overlay.addEventListener('click',()=>{closeCart();closeMenu();closeCheckout()});
function money(v){return '$'+v.toFixed(2)}
function renderCart(){
  $('.cart-trigger b').textContent=cart.length;
  const catalogCount=$('.catalog-cart-count');if(catalogCount)catalogCount.textContent=cart.length;
  $('.cart-total').textContent=money(cart.reduce((a,b)=>a+b.price,0));
  const list=$('.cart-list');
  if(!cart.length){list.innerHTML='<div class="empty-cart"><b>13</b><p>THE LINE IS EMPTY.</p></div>';return}
  list.innerHTML=cart.map((p,i)=>`<div class="cart-item"><div class="cart-thumb">13</div><div><h4>${p.name}</h4><p>${money(p.price)} · QTY 1</p></div><button class="remove-item" data-i="${i}" aria-label="Remove ${p.name}">×</button></div>`).join('');
  $$('.remove-item').forEach(b=>b.addEventListener('click',()=>{cart.splice(+b.dataset.i,1);renderCart();showToast('REMOVED FROM CART')}));
}
// Dynamic add-to-cart moved to bindProductListeners
function showToast(text){const t=$('.toast');t.textContent=text;t.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove('show'),1800)}

renderCart();

// PayPal checkout
const checkoutPanel=$('.checkout-panel');
const checkoutForm=$('#checkout-form');
const checkoutState=$('.payment-state');

function cartTotal(){return cart.reduce((sum,item)=>sum+Number(item.price),0)}
function setPaymentState(message,type='info'){
  checkoutState.textContent=message;
  checkoutState.className=`payment-state show ${type}`;
}
function clearPaymentState(){checkoutState.textContent='';checkoutState.className='payment-state'}
function renderCheckoutSummary(){
  const items=$('.checkout-items');
  items.innerHTML=cart.map(item=>`<div class="checkout-summary-item"><span>${item.name}</span><strong>${money(Number(item.price))}</strong></div>`).join('');
  $('.checkout-total strong').textContent=money(cartTotal());
}
function openCheckout(){
  if(!cart.length){showToast('YOUR CART IS EMPTY');return}
  closeCart();closeCatalog();clearPaymentState();renderCheckoutSummary();
  checkoutPanel.classList.add('open');checkoutPanel.setAttribute('aria-hidden','false');
}
function closeCheckout(){checkoutPanel.classList.remove('open');checkoutPanel.setAttribute('aria-hidden','true')}
$('.checkout-trigger').addEventListener('click',openCheckout);
$('.checkout-close').addEventListener('click',closeCheckout);
checkoutPanel.addEventListener('click',e=>{if(e.target===checkoutPanel)closeCheckout()});

async function initPayPal() {
  try {
    const res = await fetch('/api/paypal/client-id');
    const { clientId } = await res.json();
    if (!clientId) {
      console.warn('PayPal Client ID is not configured.');
      return;
    }
    
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => {
      paypal.Buttons({
        createOrder: async (data, actions) => {
          if (!checkoutForm.checkValidity()) {
              checkoutForm.reportValidity();
              throw new Error('Validation failed');
          }
          const customer = Object.fromEntries(new FormData(checkoutForm).entries());
          const response = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({cart, customer})
          });
          const result = await response.json();
          if (!response.ok) {
              setPaymentState(result.error || 'Failed to create order', 'error');
              throw new Error(result.error);
          }
          return result.id;
        },
        onApprove: async (data, actions) => {
          setPaymentState('Capturing payment...', 'info');
          const response = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({orderID: data.orderID})
          });
          const result = await response.json();
          if (!response.ok) {
              setPaymentState(result.error || 'Failed to capture payment', 'error');
              return;
          }
          setPaymentState(`Payment confirmed. Order ${data.orderID} is paid.`, 'success');
          cart = [];
          renderCart();
        },
        onError: (err) => {
          if (err.message !== 'Validation failed') {
            setPaymentState(`Payment error: ${err.message || err}`, 'error');
          }
        }
      }).render('#paypal-button-container');
    };
    document.body.appendChild(script);
  } catch (error) {
    console.error('Failed to init PayPal', error);
  }
}
initPayPal();

checkoutForm.addEventListener('submit', e => {
  e.preventDefault();
});

// Full all-merch catalog
const catalogPanel=$('.catalog-panel');
function openCatalog(){
  closeMenu();
  catalogPanel.classList.add('open');
  catalogPanel.setAttribute('aria-hidden','false');
  catalogPanel.scrollTop=0;
}
function closeCatalog(){
  catalogPanel.classList.remove('open');
  catalogPanel.setAttribute('aria-hidden','true');
}
$$('.catalog-trigger, .catalog-header-trigger').forEach(btn=>btn.addEventListener('click',openCatalog));
$('.catalog-close').addEventListener('click',closeCatalog);
$('.catalog-cart-trigger').addEventListener('click',openCart);

$$('.catalog-filter').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.catalog-filter').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  const filter=btn.dataset.filter;
  let visible=0;
  $$('.catalog-card').forEach(card=>{
    const show=filter==='all'||card.dataset.category===filter;
    card.classList.toggle('hidden',!show);
    if(show)visible++;
  });
  $('.catalog-result-count').textContent=`SHOWING ${visible} PRODUCT${visible===1?'':'S'}`;
}));

// Dynamic catalog-add moved to bindProductListeners

// Menu
const menu=$('.menu-panel');
function openMenu(){menu.classList.add('open');menu.setAttribute('aria-hidden','false')}
function closeMenu(){menu.classList.remove('open');menu.setAttribute('aria-hidden','true')}
$('.menu-trigger').addEventListener('click',openMenu);$('.menu-close').addEventListener('click',closeMenu);
$$('.menu-panel nav button[data-stage]').forEach(btn=>btn.addEventListener('click',()=>{goToStage(+btn.dataset.stage);closeMenu()}));
$('.menu-catalog-trigger').addEventListener('click',openCatalog);

// YouTube channel CTA feedback
$$('.youtube-channel-link').forEach(link=>{
  link.addEventListener('click',()=>{
    link.classList.remove('youtube-clicked');
    void link.offsetWidth;
    link.classList.add('youtube-clicked');
    showToast('OPENING @JMUNZ13 ON YOUTUBE');
  });
});

goToStage(0);
