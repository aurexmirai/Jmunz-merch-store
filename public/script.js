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

// Background Sound
let bgAudio = new Audio();
bgAudio.loop = true;

$('.sound-toggle').addEventListener('click', e => {
  const btn = e.currentTarget;
  btn.classList.toggle('on');
  if (btn.classList.contains('on')) {
    if (bgAudio.src !== backendSettings.bgSoundUrl && backendSettings.bgSoundUrl) {
      bgAudio.src = backendSettings.bgSoundUrl;
    }
    if (bgAudio.src && bgAudio.src !== window.location.href) {
      bgAudio.play().catch(err => console.log('Audio playback blocked:', err));
    }
    btn.querySelector('em').textContent = 'SOUND ON';
  } else {
    bgAudio.pause();
    btn.querySelector('em').textContent = 'SOUND OFF';
  }
});

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
  
  const soundToggle = $('.sound-toggle');
  if (soundToggle) {
    soundToggle.style.display = backendSettings.soundEnabled === false ? 'none' : '';
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
  $$('.factory-product').forEach(card => card.addEventListener('click', (e) => {
    if (!e.target.closest('.product-stage')) return;
    const name = card.dataset.name;
    const prod = backendProducts.find(p => p.name === name) || { name, price: +card.dataset.price };
    openProductPage(prod);
  }));

  $$('.catalog-card').forEach(card => card.addEventListener('click', (e) => {
    if (!e.target.closest('.catalog-image-wrap') && !e.target.closest('.catalog-add')) return;
    const name = card.dataset.name;
    const prod = backendProducts.find(p => p.name === name) || { name, price: +card.dataset.price };
    openProductPage(prod);
  }));

  const counts = { all: backendProducts.length };
  backendProducts.forEach(p => { 
    const c = p.category || 'other';
    counts[c] = (counts[c] || 0) + 1;
  });

  const filterContainer = $('#dynamic-filters');
  if (filterContainer) {
    const catsStr = backendSettings.productCategories || 'Hoodie, Tee, Accessory';
    const cats = catsStr.split(',').map(s => s.trim()).filter(Boolean);
    
    let html = `<button class="catalog-filter active" data-filter="all" type="button">ALL <span>${String(counts.all).padStart(2,'0')}</span></button>`;
    
    cats.forEach(c => {
      const val = c.toLowerCase().replace(/\s+/g, '-');
      const count = counts[val] || 0;
      html += `<button class="catalog-filter" data-filter="${val}" type="button">${c.toUpperCase()} <span>${String(count).padStart(2,'0')}</span></button>`;
    });
    
    filterContainer.innerHTML = html;
    
    $$('.catalog-filter').forEach(btn => btn.addEventListener('click', () => {
      $$('.catalog-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      $$('.catalog-card').forEach(card => {
        card.style.display = (f === 'all' || card.dataset.category === f) ? 'flex' : 'none';
      });
      $('.catalog-result-count').textContent = `SHOWING ${f === 'all' ? counts.all : (counts[f] || 0)} PRODUCTS`;
    }));
  }
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
  $('.cart-total').textContent=money(cartTotal());
  const list=$('.cart-list');
  if(!cart.length){list.innerHTML='<div class="empty-cart"><b>13</b><p>THE LINE IS EMPTY.</p></div>';return}
  list.innerHTML=cart.map((p,i)=>`<div class="cart-item"><div class="cart-thumb" style="padding:5px;"><img src="${p.image||''}" style="width:100%;height:100%;object-fit:cover;opacity:0.9;border-radius:4px;"/></div><div><h4>${p.name}</h4><p>${money(p.price)} · QTY ${p.quantity||1}</p><p style="font-size:0.55rem;opacity:0.7;margin-top:4px">${p.size ? 'SIZE: '+p.size : ''} ${p.color ? '| '+p.color : ''}</p></div><button class="remove-item" data-i="${i}" aria-label="Remove ${p.name}">×</button></div>`).join('');
  $$('.remove-item').forEach(b=>b.addEventListener('click',()=>{cart.splice(+b.dataset.i,1);renderCart();showToast('REMOVED FROM CART')}));
}
// Dynamic add-to-cart moved to bindProductListeners
function showToast(text){const t=$('.toast');t.textContent=text;t.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove('show'),1800)}

renderCart();

// PayPal checkout
const checkoutPanel=$('.checkout-panel');
const checkoutForm=$('#checkout-form');
const checkoutState=$('.payment-state');

function cartTotal(){return cart.reduce((sum,item)=>sum+(Number(item.price)*Number(item.quantity||1)),0)}
function setPaymentState(message,type='info'){
  checkoutState.textContent=message;
  checkoutState.className=`payment-state show ${type}`;
}
function clearPaymentState(){checkoutState.textContent='';checkoutState.className='payment-state'}
function renderCheckoutSummary(){
  const items=$('.checkout-items');
  items.innerHTML=cart.map(item=>`<div class="checkout-summary-item"><span>${item.quantity||1}x ${item.name} <small style="display:block;opacity:0.6;font-size:0.8em;margin-top:3px;">${item.size||''} ${item.color||''}</small></span><strong>${money(Number(item.price)*(item.quantity||1))}</strong></div>`).join('');
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

// Payment method selector logic
$$('.payment-method-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.payment-method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    $$('.payment-section').forEach(section => section.classList.remove('active'));
    $(`#${btn.dataset.target}`).classList.add('active');
  });
});

// Stripe Submit Logic
const stripeSubmitBtn = $('#stripe-submit-btn');
if (stripeSubmitBtn) {
  stripeSubmitBtn.addEventListener('click', async () => {
    if (!checkoutForm.reportValidity()) {
      showToast('PLEASE FILL OUT ALL DETAILS');
      return;
    }
    
    try {
      stripeSubmitBtn.disabled = true;
      stripeSubmitBtn.textContent = 'CREATING CHECKOUT...';
      setPaymentState('Creating Stripe Checkout session...', 'info');
      
      const customer = Object.fromEntries(new FormData(checkoutForm).entries());
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ cart, customer })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to initiate Stripe checkout');
      
      // Redirect to Stripe hosted page
      window.location.href = result.url;
    } catch (err) {
      console.error('Stripe Checkout Error:', err);
      setPaymentState(err.message, 'error');
      stripeSubmitBtn.disabled = false;
      stripeSubmitBtn.textContent = 'PAY WITH STRIPE (CARDS / APPLE / GOOGLE PAY)';
    }
  });
}

let paypalLoaded = false;
let cardFieldsInstance = null;

async function initPayPal() {
  try {
    const res = await fetch('/api/paypal/config');
    const { clientId } = await res.json();
    if (!clientId) {
      console.warn('PayPal is not configured.');
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=buttons,card-fields&currency=USD`;
    script.onload = () => {
      paypalLoaded = true;
      if ($('.checkout-panel').classList.contains('open')) {
        renderPayPalButtons();
        renderPayPalCardFields();
      }
    };
    document.body.appendChild(script);
  } catch (error) {
    console.error('Failed to init PayPal', error);
  }
}

initPayPal();

function renderPayPalButtons() {
  if (!window.paypal) return;
  const container = $('#paypal-button-container');
  if (!container) return;
  container.innerHTML = '';

  window.paypal.Buttons({
    style: {
      layout: 'vertical',
      color:  'gold',
      shape:  'rect',
      label:  'paypal',
      height: 48
    },
    onClick: (data, actions) => {
      if (!checkoutForm.reportValidity()) {
        showToast('PLEASE FILL OUT ALL DETAILS');
        return actions.reject();
      }
      return actions.resolve();
    },
    createOrder: async () => {
      try {
        setPaymentState('Creating PayPal order...', 'info');
        const customer = Object.fromEntries(new FormData(checkoutForm).entries());
        const response = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ cart, customer })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        clearPaymentState();
        return result.id;
      } catch (err) {
        setPaymentState('Failed to create order: ' + err.message, 'error');
        throw err;
      }
    },
    onApprove: async (data, actions) => {
      try {
        setPaymentState('Processing your payment...', 'info');
        const response = await fetch('/api/paypal/capture-order', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ paypalOrderId: data.orderID })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        setPaymentState('Payment confirmed! Order received.', 'success');
        cart = [];
        renderCart();
        
        setTimeout(() => {
          closeCheckout();
          showToast('ORDER PLACED SUCCESSFULLY');
        }, 2000);
      } catch (err) {
        setPaymentState('Payment failed: ' + err.message, 'error');
      }
    },
    onError: (err) => {
      console.error('PayPal error:', err);
      setPaymentState('PayPal transaction encountered an error.', 'error');
    }
  }).render('#paypal-button-container');
}

async function renderPayPalCardFields() {
  if (!window.paypal || !window.paypal.CardFields) {
    console.warn('PayPal CardFields not loaded.');
    $('#paypal-card-form').style.display = 'none';
    return;
  }

  const submitBtn = $('#paypal-card-submit-btn');
  if (cardFieldsInstance) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'PAY WITH CARD';
    return;
  }

  try {
    cardFieldsInstance = window.paypal.CardFields({
      style: {
        input: {
          'font-size': '14px',
          'font-family': 'Arial, Helvetica, sans-serif',
          'color': '#101412',
          'background': 'transparent',
          'border': 'none',
          'outline': 'none',
          'box-shadow': 'none',
          'padding': '0px',
        },
        '.focused': {
          'color': '#101412',
        },
        '.invalid': {
          'color': '#ef746d',
        }
      },
      createOrder: async () => {
        try {
          setPaymentState('Creating order...', 'info');
          submitBtn.disabled = true;
          submitBtn.textContent = 'CREATING ORDER...';
          const customer = Object.fromEntries(new FormData(checkoutForm).entries());
          const response = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cart, customer })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          return result.id;
        } catch (err) {
          setPaymentState('Failed to create order: ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'PAY WITH CARD';
          throw err;
        }
      },
      onApprove: async (data) => {
        try {
          setPaymentState('Processing your payment...', 'info');
          submitBtn.textContent = 'PROCESSING PAYMENT...';
          const response = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ paypalOrderId: data.orderID })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          
          setPaymentState('Payment confirmed! Order received.', 'success');
          submitBtn.textContent = 'SUCCESS!';
          cart = [];
          renderCart();
          
          setTimeout(() => {
            closeCheckout();
            showToast('ORDER PLACED SUCCESSFULLY');
            submitBtn.disabled = false;
            submitBtn.textContent = 'PAY WITH CARD';
          }, 2000);
        } catch (err) {
          setPaymentState('Payment failed: ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'PAY WITH CARD';
        }
      },
      onError: (err) => {
        console.error('PayPal CardFields error:', err);
        setPaymentState('Card verification failed. Please check card details.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'PAY WITH CARD';
      }
    });

    if (cardFieldsInstance.isEligible()) {
      const numberField = cardFieldsInstance.NumberField();
      await numberField.render('#card-number-container');

      const expiryField = cardFieldsInstance.ExpiryField();
      await expiryField.render('#card-expiry-container');

      const cvvField = cardFieldsInstance.CVVField();
      await cvvField.render('#card-cvv-container');

      submitBtn.addEventListener('click', async () => {
        if (!checkoutForm.reportValidity()) {
          showToast('PLEASE FILL OUT ALL DETAILS');
          return;
        }
        setPaymentState('Submitting payment...', 'info');
        submitBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING...';
        try {
          await cardFieldsInstance.submit();
        } catch (err) {
          console.error('CardFields submission error:', err);
          submitBtn.disabled = false;
          submitBtn.textContent = 'PAY WITH CARD';
        }
      });
    } else {
      console.warn('CardFields is not eligible.');
      $('#paypal-card-form').style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to render CardFields:', err);
  }
}

// Override openCheckout to render PayPal buttons when opened
const originalOpenCheckout = openCheckout;
openCheckout = function() {
  originalOpenCheckout();
  if (paypalLoaded) {
    renderPayPalButtons();
    renderPayPalCardFields();
  } else {
    setPaymentState('Loading PayPal gateway...', 'info');
  }
};

// Re-bind listeners to ensure the overridden openCheckout is used
$$('.checkout-trigger').forEach(btn => {
  btn.removeEventListener('click', originalOpenCheckout);
  btn.addEventListener('click', openCheckout);
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


// === DEDICATED PRODUCT PAGE LOGIC ===
const ppPanel = $('.product-page-panel');
let currentPpProduct = null;

const ppSwatchColors = {
  'White': '#ffffff',
  'Black': '#111111',
  'Grey': '#7a7a7a',
  'Ice Blue': '#a9c5db',
  'Blue Jean': '#4b6e8a',
  'Chambray': '#586b8c',
  'Flo Blue': '#3d83c4',
  'Granite': '#e2ded5'
};

const ppFilters = {
  'White': 'invert(0.85) brightness(1.2) contrast(0.85) grayscale(1)',
  'Black': 'none',
  'Grey': 'invert(0.4) brightness(1.0) grayscale(1)',
  'Ice Blue': 'invert(0.7) sepia(0.5) hue-rotate(160deg) saturate(2) brightness(1.1)',
  'Blue Jean': 'invert(0.3) sepia(0.8) hue-rotate(185deg) saturate(1.3) brightness(0.9)',
  'Chambray': 'invert(0.5) sepia(0.6) hue-rotate(180deg) saturate(1.0) brightness(1.0)',
  'Flo Blue': 'invert(0.4) sepia(0.9) hue-rotate(180deg) saturate(2.5) brightness(0.95)',
  'Granite': 'invert(0.15) brightness(0.85) contrast(1.1) grayscale(1)'
};

const ppDescriptions = {
  'tee': `
    <p>Premium quality embroidered t-shirt. Featuring a comfortable standard fit, clean detailing, and soft wash finish.</p>
    <ul>
      <li>100% combed ring-spun cotton</li>
      <li>Soft, lightweight wash finish</li>
      <li>Custom embroidery detailing on chest</li>
    </ul>
  `,
  'hoodie': `
    <p>An absolute classic heavyweight hoodie. Featuring a heavyweight blend, soft fleece lining, and standard fit.</p>
    <ul>
      <li>80% cotton, 20% polyester blend</li>
      <li>Soft brushed interior lining</li>
      <li>Front kangaroo pouch pocket</li>
    </ul>
  `,
  'default': `
    <p>Official community merchandise from the jMunz13 factory. Custom crafted from high-quality materials.</p>
    <ul>
      <li>Premium quality design</li>
      <li>Soft feel and durable stitching</li>
      <li>Authentic jMunz13 branding</li>
    </ul>
  `
};

const ppSizeCharts = {
  'tee': `
    <p style="font-family: var(--mono); font-size: 0.75rem; line-height: 1.5; margin: 0;">
      S &nbsp;: Width 18" / Length 28"<br/>
      M &nbsp;: Width 20" / Length 29"<br/>
      L &nbsp;: Width 22" / Length 30"<br/>
      XL : Width 24" / Length 31"<br/>
      2XL: Width 26" / Length 32"<br/>
      3XL: Width 28" / Length 33"
    </p>
  `,
  'hoodie': `
    <p style="font-family: var(--mono); font-size: 0.75rem; line-height: 1.5; margin: 0;">
      S &nbsp;: Width 20" / Length 27"<br/>
      M &nbsp;: Width 22" / Length 28"<br/>
      L &nbsp;: Width 24" / Length 29"<br/>
      XL : Width 26" / Length 30"<br/>
      2XL: Width 28" / Length 31"<br/>
      3XL: Width 30" / Length 32"
    </p>
  `,
  'default': `
    <p style="font-family: var(--mono); font-size: 0.75rem; line-height: 1.5; margin: 0;">
      Standard fit. Fits true to size. Recommended to wash cold and line dry.
    </p>
  `
};

function updatePpImageColor(colorObjOrName) {
  const img = $('#pp-product-img');
  if (img) {
    if (typeof colorObjOrName === 'object') {
      if (colorObjOrName.image) {
        img.src = colorObjOrName.image;
      } else {
        img.src = currentPpProduct.image || '';
      }
      img.style.filter = 'none';
    } else {
      img.src = currentPpProduct.image || '';
      img.style.filter = ppFilters[colorObjOrName] || 'none';
    }
  }
}

function renderPpSwatches(colorsArr) {
  const container = $('#pp-swatches-grid');
  if (!container) return;
  container.innerHTML = '';
  
  colorsArr.forEach((c, i) => {
    const isObj = typeof c === 'object';
    const cName = isObj ? c.name : c;
    const cHex = isObj ? c.hex : (ppSwatchColors[c] || '#ffffff');
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pp-swatch' + (i === 0 ? ' active' : '');
    btn.dataset.colorName = cName;
    btn.style.setProperty('--swatch-color', cHex);
    btn.title = cName;
    
    btn.addEventListener('click', () => {
      $$('.pp-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      $('#pp-color-label').textContent = `COLOR: ${(cName || '').toUpperCase()}`;
      
      const select = $('#pp-color-select');
      if (select) select.value = cName;
      
      updatePpImageColor(c);
    });
    
    container.appendChild(btn);
  });
}

function openProductPage(product) {
  currentPpProduct = product;
  $('#pp-product-name').textContent = product.name;
  
  // Set Category
  const category = (product.category || 'item').toUpperCase();
  $('#pp-product-category').textContent = category;
  
  // Set Description & Size Chart
  const catKey = product.category || 'default';
  $('#pp-desc-content').innerHTML = ppDescriptions[catKey] || ppDescriptions['default'];
  $('#pp-size-chart-content').innerHTML = ppSizeCharts[catKey] || ppSizeCharts['default'];
  
  // Set Image
  const img = $('#pp-product-img');
  if (img) {
    img.src = product.image || '';
    img.alt = product.name;
  }
  
  // Render Swatches
  const colorsToRender = product.colors && product.colors.length > 0 
    ? product.colors 
    : ['White', 'Black', 'Grey', 'Ice Blue', 'Blue Jean', 'Chambray', 'Flo Blue', 'Granite'];
    
  renderPpSwatches(colorsToRender);
  
  // Reset Hidden Select
  const select = $('#pp-color-select');
  if (select) {
    select.innerHTML = colorsToRender.map(c => {
      const cName = typeof c === 'object' ? c.name : c;
      return `<option value="${cName}">${cName}</option>`;
    }).join('');
    select.selectedIndex = 0;
  }
  
  // Set Initial Color Label
  const firstCName = typeof colorsToRender[0] === 'object' ? colorsToRender[0].name : colorsToRender[0];
  $('#pp-color-label').textContent = `COLOR: ${(firstCName || '').toUpperCase()}`;
  updatePpImageColor(colorsToRender[0]);
  
  // Reset Quantity
  $('#pp-qty-input').value = 1;
  
  // Reset Size Chart
  const sizeRadios = $$('input[name="pp_size"]');
  if (sizeRadios && sizeRadios.length > 0) {
    sizeRadios[0].checked = true;
  }
  updatePpPrice();
  
  closeCart();
  closeCatalog();
  ppPanel.classList.add('open');
  ppPanel.setAttribute('aria-hidden', 'false');
  
  // Update cart count inside product page header
  const pCartTotal = $('.product-page-cart-trigger b');
  if (pCartTotal) {
    pCartTotal.textContent = cart.length;
  }
}

function closeProductPage() {
  ppPanel.classList.remove('open');
  ppPanel.setAttribute('aria-hidden', 'true');
  currentPpProduct = null;
}

function updatePpPrice() {
  if (!currentPpProduct) return;
  const basePrice = Number(currentPpProduct.price);
  const sizeRadio = $('input[name="pp_size"]:checked');
  const sizeAdd = sizeRadio && sizeRadio.dataset.priceAdd ? Number(sizeRadio.dataset.priceAdd) : 0;
  const unitPrice = basePrice + sizeAdd;
  const qty = Number($('#pp-qty-input').value);
  const total = unitPrice * qty;
  
  $('#pp-product-price').textContent = money(unitPrice);
  $('#pp-total-price').textContent = money(total);
}

$('#pp-qty-minus').addEventListener('click', () => {
  const inp = $('#pp-qty-input');
  if (inp.value > 1) { inp.value = Number(inp.value) - 1; updatePpPrice(); }
});
$('#pp-qty-plus').addEventListener('click', () => {
  const inp = $('#pp-qty-input');
  if (inp.value < 99) { inp.value = Number(inp.value) + 1; updatePpPrice(); }
});

$$('input[name="pp_size"]').forEach(r => r.addEventListener('change', updatePpPrice));

$('.product-page-back').addEventListener('click', closeProductPage);

// Connect Cart trigger inside product page header
$('.product-page-cart-trigger').addEventListener('click', openCart);

// Override renderCart to update the cart count in the product page too
const originalRenderCart = renderCart;
renderCart = function() {
  originalRenderCart();
  const pCartTotal = $('.product-page-cart-trigger b');
  if (pCartTotal) {
    pCartTotal.textContent = cart.length;
  }
};

$('#pp-confirm-btn').addEventListener('click', () => {
  if (!currentPpProduct) return;
  
  const sizeRadio = $('input[name="pp_size"]:checked');
  const sizeAdd = sizeRadio && sizeRadio.dataset.priceAdd ? Number(sizeRadio.dataset.priceAdd) : 0;
  
  const cartItem = {
    id: currentPpProduct.id,
    name: currentPpProduct.name,
    price: Number(currentPpProduct.price) + sizeAdd,
    color: $('#pp-color-select').value,
    size: sizeRadio ? sizeRadio.value : 'S',
    quantity: Number($('#pp-qty-input').value),
    image: currentPpProduct.image
  };
  
  cart.push(cartItem);
  renderCart();
  closeProductPage();
  openCart();
  showToast('ADDED TO CART');
});

$('#pp-buy-now-btn').addEventListener('click', () => {
  if (!currentPpProduct) return;
  const sizeRadio = $('input[name="pp_size"]:checked');
  const sizeAdd = sizeRadio && sizeRadio.dataset.priceAdd ? Number(sizeRadio.dataset.priceAdd) : 0;
  const cartItem = {
    id: currentPpProduct.id,
    name: currentPpProduct.name,
    price: Number(currentPpProduct.price) + sizeAdd,
    color: $('#pp-color-select').value,
    size: sizeRadio ? sizeRadio.value : 'S',
    quantity: Number($('#pp-qty-input').value),
    image: currentPpProduct.image
  };
  cart.push(cartItem);
  renderCart();
  closeProductPage();
  openCheckout();
});


