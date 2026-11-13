const fs = require('node:fs');
const vm = require('node:vm');

const bundlePath = 'assets/index-D2RoHgHG.js';
let bundle = fs.readFileSync(bundlePath, 'utf8');

function replaceExact(label, oldStr, newStr) {
  const idx = bundle.indexOf(oldStr);
  if (idx === -1) {
    throw new Error(`Could not locate exact target for: ${label}`);
  }
  const secondIdx = bundle.indexOf(oldStr, idx + 1);
  if (secondIdx !== -1) {
    throw new Error(`Ambiguous target (multiple matches) for: ${label}`);
  }
  bundle = bundle.slice(0, idx) + newStr + bundle.slice(idx + oldStr.length);
  console.log(`[PATCH OK] ${label}`);
}

// ============================================================================
// 1. Fix Product Cache, Media Preservation, & Firestore Real-time Sync
// ============================================================================
const oldDbStart = 'var OE=`vidhyaa_products_cache`;';
const oldDbEnd = 'typeof window<`u`&&window.dispatchEvent(new CustomEvent(`vidhyaa_products_updated`,{detail:t}))}';
const dbStartIdx = bundle.indexOf(oldDbStart);
const dbEndIdx = bundle.indexOf(oldDbEnd, dbStartIdx);
if (dbStartIdx === -1 || dbEndIdx === -1) {
  throw new Error('Could not locate dbService product block');
}
const oldDbBlock = bundle.slice(dbStartIdx, dbEndIdx + oldDbEnd.length);

const newDbBlock = `var OE=\`vidhyaa_products_cache\`;
let __vidhyaaMemProducts=[];
function __normVidUrl(u){
  if(!u||typeof u!==\`string\`)return \`\`;
  let s=u.trim().replace(/^https?:\\/\\/(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?(\\/.*)$/i,\`$1\`);
  if(/^videos\\/uploads\\//i.test(s))s=\`/\`+s;
  return s;
}
function __mergeProductMedia(incoming,fallback){
  if(!incoming||typeof incoming!==\`object\`)return incoming;
  let incImgs=Array.isArray(incoming.images)?incoming.images.filter(x=>typeof x===\`string\`&&x.trim().length>0):[];
  let fbImgs=fallback&&Array.isArray(fallback.images)?fallback.images.filter(x=>typeof x===\`string\`&&x.trim().length>0):[];
  let mergedImgs=incImgs.length>0?incImgs:fbImgs;
  let mergedVars=Array.isArray(incoming.variations)&&incoming.variations.length>0
    ?incoming.variations.map((v,idx)=>{
      let fv=fallback?.variations?.[idx]||(fallback?.variations||[]).find(x=>x&&v&&x.id===v.id);
      let img=(v&&typeof v.image===\`string\`&&v.image.trim())?v.image:(fv?.image||mergedImgs[0]||\`\`);
      return{...v,image:img};
    })
    :(fallback?.variations||[]);
  let rawVid=__normVidUrl(incoming.videoUrl||incoming.video||incoming.videoURL||fallback?.videoUrl||\`\`);
  let out={
    ...incoming,
    images:mergedImgs,
    variations:mergedVars,
    videoUrl:rawVid||void 0,
    showInShoppingVideos:incoming.showInShoppingVideos!==void 0?incoming.showInShoppingVideos:fallback?.showInShoppingVideos
  };
  if(out._strippedImg&&mergedImgs.length>0)delete out._strippedImg;
  return out;
}
function kE(){
  let baseMap=new Map();
  if(Array.isArray(_E)){
    _E.forEach(p=>{if(p&&p.id)baseMap.set(p.id,p);});
  }
  if(Array.isArray(__vidhyaaMemProducts)&&__vidhyaaMemProducts.length>0){
    __vidhyaaMemProducts.forEach(p=>{if(p&&p.id)baseMap.set(p.id,__mergeProductMedia(p,baseMap.get(p.id)));});
    return Array.from(baseMap.values());
  }
  if(typeof localStorage>\`u\`)return[];
  try{
    let raw=localStorage.getItem(OE);
    if(!raw)return[];
    let parsed=JSON.parse(raw);
    if(!Array.isArray(parsed))return[];
    return parsed.map(p=>{
      if(!p||!p.id)return p;
      let fb=baseMap.get(p.id);
      return __mergeProductMedia(p,fb);
    });
  }catch{return[]}
}
function AE(e){
  if(!Array.isArray(e)||e.length===0)return;
  let prevMap=new Map();
  if(Array.isArray(_E))_E.forEach(p=>{if(p&&p.id)prevMap.set(p.id,p);});
  if(Array.isArray(__vidhyaaMemProducts))__vidhyaaMemProducts.forEach(p=>{if(p&&p.id)prevMap.set(p.id,p);});
  let clean=e.map(p=>p&&p.id?__mergeProductMedia(p,prevMap.get(p.id)):p);
  __vidhyaaMemProducts=clean;
  if(typeof localStorage<\`u\`){
    try{
      localStorage.setItem(OE,JSON.stringify(clean));
    }catch{
      try{
        let slim=clean.map(item=>{
          if(!item||typeof item!==\`object\`)return item;
          let hadDataImg=(Array.isArray(item.images)&&item.images.some(x=>typeof x===\`string\`&&x.startsWith(\`data:image/\`)))
            ||(Array.isArray(item.variations)&&item.variations.some(v=>v&&typeof v.image===\`string\`&&v.image.startsWith(\`data:image/\`)));
          let imgs=Array.isArray(item.images)?item.images.map(x=>typeof x===\`string\`&&x.startsWith(\`data:image/\`)?\`\`:x).filter(Boolean):[];
          let vars=Array.isArray(item.variations)?item.variations.map(v=>v&&typeof v.image===\`string\`&&v.image.startsWith(\`data:image/\`)?{...v,image:\`\`}:v):item.variations;
          let copy={...item,images:imgs,variations:vars};
          if(hadDataImg)copy._strippedImg=!0;
          return copy;
        });
        localStorage.setItem(OE,JSON.stringify(slim));
      }catch(err){
        console.warn(\`[Cache Diagnostic] Could not persist products to localStorage:\`,err);
      }
    }
  }
}
function jE(e){if(!e||typeof e!=\`string\`)return\`\`;let t=e.trim();return pE(t)||t.startsWith(\`/\`)||t.startsWith(\`http://\`)||t.startsWith(\`https://\`)||t.startsWith(\`data:\`)?t:\`\`}
function ME(e){let t=String(e.id||\`\`).trim(),n=String(e.name||\`\`).trim(),r=String(e.slug||n||\`jewellery-piece\`).toLowerCase().replace(/[^a-z0-9]+/g,\`-\`).replace(/^-+|-+$/g,\`\`)||\`jewellery-piece\`,i=typeof e.price==\`number\`&&!isNaN(e.price)?Math.max(0,Math.round(e.price)):0,a=typeof e.mrp==\`number\`&&!isNaN(e.mrp)?Math.max(0,Math.round(e.mrp)):i,o=a>i&&a>0?Math.round((a-i)/a*100):0,s=typeof e.stock==\`number\`&&!isNaN(e.stock)?Math.max(0,Math.round(e.stock)):0,c=s>0,l=Array.isArray(e.images)?e.images.filter(e=>typeof e==\`string\`&&e.trim().length>0).map(e=>jE(e)).filter(Boolean):[],u=Array.isArray(e.variations)&&(e?.variations?.length||0)>0?(e.variations||[]).map((e,n)=>{let r=e.image&&typeof e.image==\`string\`&&e.image.trim().length>0?jE(e.image):l[0]||\`\`,o=typeof e.stock==\`number\`&&!isNaN(e.stock)?Math.max(0,Math.round(e.stock)):5,s={id:String(e.id||\`var_\${t||Date.now()}_\${n}\`).trim(),name:String(e.name||\`Imperial Yellow Gold\`).trim(),colorFinish:String(e.colorFinish||\`Yellow Gold\`).trim(),hexCode:String(e.hexCode||\`#D4AF37\`).trim(),sku:String(e.sku||\`VDH-\${Date.now()}-\${n}\`).trim(),stock:o,image:r,active:e.active!==!1,price:i,mrp:a};return Array.isArray(e.additionalImages)&&(s.additionalImages=e.additionalImages.filter(e=>typeof e==\`string\`&&e.trim().length>0)),s}):[],d={id:t,name:n,slug:r,categoryId:String(e.categoryId||\`necklaces\`).trim(),categoryName:String(e.categoryName||\`Necklaces & Necklace Sets\`).trim(),subcategory:String(e.subcategory||\`Necklaces\`).trim(),description:String(e.description||\`\`).trim(),material:String(e.material||\`22K Micro Gold Plated Brass & Heritage Kundan\`).trim(),price:i,mrp:a,discountPercent:o,images:l,stock:s,inStock:c,active:e.active!==!1,status:e.status||(e.active===!1?\`draft\`:\`published\`),published:e.published===void 0?e.active!==!1:!!e.published,rating:typeof e.rating==\`number\`&&!isNaN(e.rating)?e.rating:5,reviewCount:typeof e.reviewCount==\`number\`&&!isNaN(e.reviewCount)?e.reviewCount:1,careInstructions:String(e.careInstructions||\`Keep away from water and perfumes. Store in airtight pouch.\`).trim(),variations:u,createdAt:e.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(e.shortDescription&&typeof e.shortDescription==\`string\`&&e.shortDescription.trim())d.shortDescription=e.shortDescription.trim();let nv=__normVidUrl(e.videoUrl||e.video||e.videoURL||\`\`);if(nv){d.videoUrl=nv;d.showInShoppingVideos=e.showInShoppingVideos!==!1}if(typeof e.showInShoppingVideos==\`boolean\`)d.showInShoppingVideos=e.showInShoppingVideos;if(typeof e.isFeatured==\`boolean\`)d.isFeatured=e.isFeatured;if(typeof e.isBestseller==\`boolean\`)d.isBestseller=e.isBestseller;if(typeof e.isNewArrival==\`boolean\`)d.isNewArrival=e.isNewArrival;if(e.specifications&&typeof e.specifications==\`object\`)d.specifications=e.specifications;return d}
async function FE(){try{let e=await EC(Hg(rE,yE)),t=!1;if(e.empty)t=!0;else{let n=!1;e.forEach(e=>{let t=e.data();(t.images||[]).some(e=>pE(e))&&(n=!0)}),n||(t=!0)}if(t){for(let e of gE)await DC(Ug(rE,yE,e.id),e);for(let e of _E){let t=ME(e);await DC(Ug(rE,yE,t.id),t)}await DC(Ug(rE,oE,vE.id),vE),XE(gE),AE(_E),console.log(\`[Firestore] Catalog successfully seeded with initial products and categories.\`)}}catch(t){sE(t,oE.WRITE,\`catalog_seed\`)}}
async function WE(){
  let e=kE(),t=IE(),n=new Map;
  _E.forEach(p=>{!t.has(p.id)&&hE(p)&&n.set(p.id,__mergeProductMedia(p,null))});
  let apiSucceeded=!1;
  try{
    if(typeof fetch<\`u\`){
      let res=await fetch(\`/api/products\`,{cache:\`no-store\`}).catch(()=>null);
      if(res&&res.ok){
        let r=await res.json().catch(()=>null);
        if(Array.isArray(r)&&r.length>0){
          apiSucceeded=!0;
          r.forEach(p=>{
            if(hE(p)&&!t.has(p.id)){
              n.set(p.id,__mergeProductMedia(p,n.get(p.id)));
            }
          });
        }
      }
    }
  }catch{}
  Array.isArray(e)&&e.length>0&&e.forEach(p=>{
    if(hE(p)&&!t.has(p.id)){
      let existing=n.get(p.id);
      if(!existing){
        n.set(p.id,__mergeProductMedia(p,null));
      }else if(!p._strippedImg){
        let existingTs=new Date(existing.updatedAt||existing.createdAt||0).getTime();
        let cacheTs=new Date(p.updatedAt||p.createdAt||0).getTime();
        if(cacheTs>existingTs||!apiSucceeded){
          n.set(p.id,__mergeProductMedia(p,existing));
        }
      }
    }
  });
  try{
    (await EC(Hg(rE,yE))).forEach(doc=>{
      let r=doc.data(),
          i=Array.isArray(r.images)?r.images.map(x=>jE(x)).filter(Boolean):[],
          a=typeof r.mrp==\`number\`&&!isNaN(r.mrp)?r.mrp:r.price||0,
          o=typeof r.price==\`number\`&&!isNaN(r.price)?r.price:0,
          s=typeof r.discountPercent==\`number\`?r.discountPercent:a>o&&a>0?Math.round((a-o)/a*100):0,
          c=Array.isArray(r.variations)?r.variations.map(v=>({...v,price:typeof v.price==\`number\`?v.price:o,mrp:typeof v.mrp==\`number\`?v.mrp:a,image:jE(v.image)})):[],
          l=__normVidUrl(r.videoUrl||r.video||r.videoURL||\`\`),
          u={id:doc.id,name:r.name||\`\`,slug:r.slug||doc.id,categoryId:r.categoryId||\`necklaces\`,categoryName:r.categoryName||\`Necklaces & Necklace Sets\`,subcategory:r.subcategory||\`Necklaces\`,description:r.description||\`\`,shortDescription:r.shortDescription,material:r.material||\`22K Micro Gold Plated Brass\`,price:o,mrp:a,discountPercent:s,images:i,stock:typeof r.stock==\`number\`?r.stock:0,inStock:typeof r.stock==\`number\`?r.stock>0:!!r.inStock,isFeatured:typeof r.isFeatured!=\`boolean\`||r.isFeatured,isBestseller:!!r.isBestseller,isNewArrival:typeof r.isNewArrival!=\`boolean\`||r.isNewArrival,active:r.active!==!1&&r.status!==\`draft\`,status:r.status||(r.active===!1?\`draft\`:\`published\`),published:r.published===void 0?r.active!==!1:!!r.published,rating:typeof r.rating==\`number\`?r.rating:5,reviewCount:typeof r.reviewCount==\`number\`?r.reviewCount:1,specifications:r.specifications||{},careInstructions:r.careInstructions||\`\`,variations:c,videoUrl:l||void 0,showInShoppingVideos:typeof r.showInShoppingVideos==\`boolean\`?r.showInShoppingVideos:void 0,createdAt:r.createdAt||new Date().toISOString(),updatedAt:r.updatedAt||r.createdAt||new Date().toISOString()};
      if(hE(u)&&!t.has(u.id)){
        let existing=n.get(u.id);
        if(!existing){n.set(u.id,u);}
        else{
          let existingTs=new Date(existing.updatedAt||existing.createdAt||0).getTime(),
              fbTs=new Date(u.updatedAt||u.createdAt||0).getTime();
          if(fbTs>=existingTs){
            n.set(u.id,__mergeProductMedia(u,existing));
          }else{
            n.set(u.id,__mergeProductMedia(existing,u));
          }
        }
      }
    });
  }catch(err){
    err?.code===\`resource-exhausted\`||err?.message?.includes(\`Quota limit exceeded\`)
      ?console.warn(\`[Firestore Notice] Daily free read quota currently active; serving from unified local catalog store.\`)
      :console.warn(\`[Firestore] Notice fetching products from Firestore:\`,err?.message||err);
  }
  let r=Array.from(n.values());
  r.sort((e,t)=>new Date(t.updatedAt||t.createdAt||0).getTime()-new Date(e.updatedAt||e.createdAt||0).getTime());
  AE(r);
  return r;
}
function GE(e,t){
  try{
    return jC(Hg(rE,yE),snap=>{
      let n=IE(),r=[];
      snap.forEach(doc=>{
        let t=doc.data(),
            i=Array.isArray(t.images)?t.images.map(x=>jE(x)).filter(Boolean):[],
            a=typeof t.mrp==\`number\`&&!isNaN(t.mrp)?t.mrp:t.price||0,
            o=typeof t.price==\`number\`&&!isNaN(t.price)?t.price:0,
            s=typeof t.discountPercent==\`number\`?t.discountPercent:a>o&&a>0?Math.round((a-o)/a*100):0,
            c=Array.isArray(t.variations)?t.variations.map(v=>({...v,price:typeof v.price==\`number\`?v.price:o,mrp:typeof v.mrp==\`number\`?v.mrp:a,image:jE(v.image)})):[],
            l=__normVidUrl(t.videoUrl||t.video||t.videoURL||\`\`),
            u={id:doc.id,name:t.name||\`\`,slug:t.slug||doc.id,categoryId:t.categoryId||\`necklaces\`,categoryName:t.categoryName||\`Necklaces & Necklace Sets\`,subcategory:t.subcategory||\`Necklaces\`,description:t.description||\`\`,shortDescription:t.shortDescription,material:t.material||\`22K Micro Gold Plated Brass\`,price:o,mrp:a,discountPercent:s,images:i,stock:typeof t.stock==\`number\`?t.stock:0,inStock:typeof t.stock==\`number\`?t.stock>0:!!t.inStock,isFeatured:typeof t.isFeatured!=\`boolean\`||t.isFeatured,isBestseller:!!t.isBestseller,isNewArrival:typeof t.isNewArrival!=\`boolean\`||t.isNewArrival,active:t.active!==!1&&t.status!==\`draft\`,status:t.status||(t.active===!1?\`draft\`:\`published\`),published:t.published===void 0?t.active!==!1:!!t.published,rating:typeof t.rating==\`number\`?t.rating:5,reviewCount:typeof t.reviewCount==\`number\`?t.reviewCount:1,specifications:t.specifications||{},careInstructions:t.careInstructions||\`\`,variations:c,videoUrl:l||void 0,showInShoppingVideos:typeof t.showInShoppingVideos==\`boolean\`?t.showInShoppingVideos:void 0,createdAt:t.createdAt||new Date().toISOString(),updatedAt:t.updatedAt||t.createdAt||new Date().toISOString()};
        hE(u)&&!n.has(u.id)&&r.push(u);
      });
      if(r.length>0){
        let base=(__vidhyaaMemProducts.length>0?__vidhyaaMemProducts:kE()),i=new Map;
        _E.forEach(p=>{!n.has(p.id)&&hE(p)&&i.set(p.id,__mergeProductMedia(p,null))});
        base.forEach(p=>{!n.has(p.id)&&hE(p)&&i.set(p.id,__mergeProductMedia(p,i.get(p.id)))});
        r.forEach(p=>{
          if(!n.has(p.id)&&hE(p)){
            let o=i.get(p.id);
            if(!o)i.set(p.id,p);
            else{
              let s=new Date(o.updatedAt||o.createdAt||0).getTime(),
                  c=new Date(p.updatedAt||p.createdAt||0).getTime();
              i.set(p.id,c>=s?__mergeProductMedia(p,o):__mergeProductMedia(o,p));
            }
          }
        });
        let a=Array.from(i.values()).sort((e,t)=>new Date(t.updatedAt||t.createdAt||0).getTime()-new Date(e.updatedAt||e.createdAt||0).getTime());
        AE(a),e(a);
      }
    },err=>{console.warn(\`[Firestore] onSnapshot notice on products collection:\`,err?.message||err),t&&t(err)});
  }catch(err){return console.warn(\`[Firestore] Could not attach onSnapshot listener:\`,err),()=>{}}
}
async function KE(e){
  let t=ME(e);
  t.videoUrl&&t.showInShoppingVideos===void 0&&(t.showInShoppingVideos=!0);
  RE(t.id);
  let n=!1,r=null;
  try{await DC(Ug(rE,yE,t.id),t),n=!0,console.log(\`[Firestore] Product "\${t.name}" (\${t.id}) saved successfully.\`)}catch(e){r=e,console.error(\`[Firestore] Error saving product to Firestore:\`,e)}
  let i=!1;
  try{
    if(typeof fetch<\`u\`){
      let tok=(typeof sessionStorage<\`u\`?sessionStorage.getItem(\`vidhyaa_admin_token\`):null)||(typeof localStorage<\`u\`?localStorage.getItem(\`vidhyaa_admin_token\`):null)||\`vidhyaa-admin-authorized\`,
          res=await fetch(\`/api/products\`,{method:\`POST\`,headers:{"Content-Type":\`application/json\`,Authorization:\`Bearer \${tok}\`,"x-admin-token":tok},body:JSON.stringify({product:t})}).catch(()=>null);
      res&&res.ok&&(i=!0,console.log(\`[Server] Product "\${t.name}" (\${t.id}) saved to server store.\`));
    }
  }catch(e){console.warn(\`[Server] Notice saving product to server endpoint:\`,e)}
  let a=kE(),o=a.findIndex(x=>x.id===t.id);
  if(o===-1?a.unshift(t):a[o]=t,AE(a),typeof window<\`u\`&&window.dispatchEvent(new CustomEvent(\`vidhyaa_products_updated\`,{detail:a})),!n){
    if(i||a.length>0)console.warn(\`[Firestore Warning] Firestore write delayed (\${r?.message||\`offline/quota\`}). Product preserved in server and local store.\`);
    else if(r)sE(r,oE.WRITE,\`\${yE}/\${t.id}\`);
    else throw Error(\`Failed to confirm product save to database.\`);
  }
  return t;
}
async function qE(e){
  LE(e);
  let t=kE().filter(x=>x.id!==e);
  __vidhyaaMemProducts=t;
  AE(t);
  try{await kC(Ug(rE,yE,e)),console.log(\`[Firestore] Product "\${e}" deleted successfully.\`)}catch(e){console.warn(\`[Firestore] Notice deleting product from Firestore:\`,e)}
  try{
    if(typeof fetch<\`u\`){
      let tok=(typeof sessionStorage<\`u\`?sessionStorage.getItem(\`vidhyaa_admin_token\`):null)||(typeof localStorage<\`u\`?localStorage.getItem(\`vidhyaa_admin_token\`):null)||\`vidhyaa-admin-authorized\`;
      await fetch(\`/api/products/\${encodeURIComponent(e)}\`,{method:\`DELETE\`,headers:{Authorization:\`Bearer \${tok}\`,"x-admin-token":tok}}).catch(()=>null);
    }
  }catch(e){console.warn(\`[Server] Notice deleting product from server endpoint:\`,e)}
  typeof window<\`u\`&&window.dispatchEvent(new CustomEvent(\`vidhyaa_products_updated\`,{detail:t}));
}`;

replaceExact('dbService product cache & sync', oldDbBlock, newDbBlock);

// ============================================================================
// 2. Fix SeamlessLoopVideo.tsx (Lk)
// ============================================================================
const lkStart = bundle.indexOf('var Ik=`/app/applet/src/components/SeamlessLoopVideo.tsx`,Lk=');
const lkEnd = bundle.indexOf(';var Rk=`data:image/svg+xml', lkStart);
if (lkStart === -1 || lkEnd === -1) {
  throw new Error('Could not locate SeamlessLoopVideo Lk block');
}
const oldLkBlock = bundle.slice(lkStart, lkEnd);

const newLkBlock = `var Ik=\`/app/applet/src/components/SeamlessLoopVideo.tsx\`,Lk=(0,x.forwardRef)(({src:e,poster:t,fallbackImage:n,title:r,autoPlay:i=!0,isMuted:a=!0,controls:o=!1,enableObserver:s=!0,observerThreshold:c=.05,showPlayButtonFallback:l=!0,onError:u,onLoadedData:d,onCanPlay:f,className:p=\`\`,style:m,"aria-hidden":h,tabIndex:g},_)=>{
  let cleanSrc=typeof e===\`string\`?e.trim().replace(/^https?:\\/\\/(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?(\\/.*)$/i,\`$1\`).replace(/^(videos\\/uploads\\/)/i,\`/$1\`):\`\`;
  let v=(0,x.useRef)(null),y=(0,x.useRef)(null),b=(0,x.useRef)(!1),prevSrc=(0,x.useRef)(cleanSrc),
      [ee,te]=(0,x.useState)(!1),[ne,re]=(0,x.useState)(!1),[S,ie]=(0,x.useState)(!1),[ae,oe]=(0,x.useState)(!0),
      w=(t&&typeof t===\`string\`&&t.trim()&&!t.startsWith(\`data:image/svg+xml\`))?t:(n&&typeof n===\`string\`&&n.trim()&&!n.startsWith(\`data:image/svg+xml\`)?n:void 0);
  let se=(0,x.useCallback)(async()=>{
    let el=v.current;
    if(!el||!cleanSrc)return;
    try{
      el.muted=a,el.defaultMuted=a,a?el.setAttribute(\`muted\`,\`\`):el.removeAttribute(\`muted\`);
      el.playsInline=!0,el.setAttribute(\`playsinline\`,\`\`),el.setAttribute(\`webkit-playsinline\`,\`true\`);
      let pr=el.play();
      pr!==void 0&&(await pr,te(!0),re(!1),ie(!1));
    }catch(err){
      if(err?.name===\`NotAllowedError\`){
        if(!el.muted){
          try{el.muted=!0,el.defaultMuted=!0,el.setAttribute(\`muted\`,\`\`),await el.play(),te(!0),re(!1),ie(!1);return}catch{}
        }
        re(!0),te(!1);
      }else if(err?.name!==\`AbortError\`){
        console.warn(\`[Video Player] Playback attempt notice:\`,err?.message||err);
      }
    }
  },[a,cleanSrc]);
  let ce=(0,x.useCallback)(el=>{
    v.current=el;
    if(el){
      el.muted=a,el.defaultMuted=a,el.playsInline=!0;
      el.setAttribute(\`playsinline\`,\`\`),el.setAttribute(\`webkit-playsinline\`,\`true\`);
      a?el.setAttribute(\`muted\`,\`\`):el.removeAttribute(\`muted\`);
    }
  },[]);
  (0,x.useEffect)(()=>{
    let el=v.current;
    if(!el)return;
    el.muted=a,el.defaultMuted=a,a?el.setAttribute(\`muted\`,\`\`):el.removeAttribute(\`muted\`);
    if(i&&ae&&!b.current&&el.paused)se();
  },[a,i,ae,se]);
  (0,x.useImperativeHandle)(_,()=>({
    play:async()=>(b.current=!1,v.current?(re(!1),v.current.play()):void 0),
    pause:()=>{b.current=!0,v.current&&(v.current.pause(),te(!1))},
    toggleMute:()=>{
      if(v.current){
        let m2=!v.current.muted;
        return v.current.muted=m2,v.current.defaultMuted=m2,m2?v.current.setAttribute(\`muted\`,\`\`):v.current.removeAttribute(\`muted\`),m2;
      }
      return!0;
    },
    get videoElement(){return v.current}
  }),[]);
  (0,x.useEffect)(()=>{
    if(!s){oe(!0);return}
    let el=y.current||v.current;
    if(!el||typeof IntersectionObserver>\`u\`){oe(!0);return}
    let obs=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        let vis=entry.isIntersecting||entry.intersectionRatio>0;
        oe(vis);
        let vid=v.current;
        if(vid){
          if(vis){i&&vid.paused&&!b.current&&se();}
          else if(!vid.paused){try{vid.pause(),te(!1)}catch{}}
        }
      });
    },{threshold:[0,.05,.2],rootMargin:\`150px 150px 150px 150px\`});
    return obs.observe(el),()=>obs.disconnect();
  },[s,i,se]);
  (0,x.useEffect)(()=>{
    if(!i||!ae)return;
    let resume=()=>{let el=v.current;el&&el.paused&&!b.current&&se()};
    return window.addEventListener(\`touchstart\`,resume,{passive:!0,once:!0}),
           window.addEventListener(\`click\`,resume,{passive:!0,once:!0}),
           window.addEventListener(\`scroll\`,resume,{passive:!0,once:!0}),
           ()=>{window.removeEventListener(\`touchstart\`,resume),window.removeEventListener(\`click\`,resume),window.removeEventListener(\`scroll\`,resume)};
  },[i,ae,se]);
  (0,x.useEffect)(()=>{
    ie(!1),re(!1);
    let el=v.current;
    if(el&&cleanSrc){
      if(prevSrc.current!==cleanSrc){
        prevSrc.current=cleanSrc;
        try{el.load()}catch{}
      }
      i&&ae&&!b.current&&se();
    }
  },[cleanSrc]);
  let le=()=>{let el=v.current;if(el){el.currentTime=0;let pr=el.play();pr!==void 0&&pr.catch(()=>{})}},
      ue=()=>{let el=v.current;if(el&&el.duration>.5&&(el.ended||el.currentTime>=el.duration-.08)){el.currentTime=0;let pr=el.play();pr!==void 0&&pr.catch(()=>{})}},
      de=()=>{te(!1);let el=v.current;if(el&&!b.current&&ae&&i&&(el.ended||el.duration>0&&el.currentTime>=el.duration-.2)){el.currentTime=0;let pr=el.play();pr!==void 0&&pr.catch(()=>{})}},
      fe=ev=>{i&&ae&&!b.current&&se(),f?.(ev)},
      pe=ev=>{console.warn(\`[Video Player] Video error notice on src:\`,cleanSrc);let el=v.current;(!el||el.readyState===0)&&(ie(!0),te(!1)),u?.(ev)},
      me=ev=>{ev.stopPropagation(),b.current=!1,re(!1),ie(!1);let el=v.current;el&&(el.muted=a,el.play().then(()=>te(!0)).catch(()=>{}))},
      he=ev=>{ev.stopPropagation(),b.current=!1,ie(!1),re(!1);let el=v.current;el&&(el.load(),el.play().then(()=>te(!0)).catch(()=>{}))};
  return(0,I.jsxDEV)(\`div\`,{ref:y,className:\`relative w-full h-full flex items-center justify-center overflow-hidden\`,style:m,children:[
    (0,I.jsxDEV)(\`video\`,{
      ref:ce,
      src:cleanSrc||void 0,
      poster:w,
      title:r,
      autoPlay:i,
      muted:a,
      controls:o,
      loop:!0,
      playsInline:!0,
      "webkit-playsinline":\`true\`,
      preload:\`auto\`,
      onEnded:le,
      onTimeUpdate:ue,
      onError:pe,
      onLoadedMetadata:ev=>{i&&ae&&!b.current&&se(),d?.(ev)},
      onLoadedData:ev=>{d?.(ev)},
      onCanPlay:fe,
      onPlaying:ev=>{te(!0),re(!1),ie(!1),d?.(ev)},
      onPlay:()=>{te(!0),re(!1)},
      onPause:de,
      className:\`\${p} relative\`,
      style:{width:\`100%\`,height:\`100%\`,...m,position:\`relative\`,zIndex:2,opacity:S&&w?0:1},
      "aria-hidden":h,
      tabIndex:g
    },void 0,!1,{fileName:Ik,lineNumber:368,columnNumber:9},void 0),
    l&&ne&&!ee&&!o&&(0,I.jsxDEV)(\`div\`,{onClick:me,className:\`absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-20 cursor-pointer transition-all duration-300 hover:bg-black/50\`,title:\`Click to play video\`,children:[(0,I.jsxDEV)(\`div\`,{className:\`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#DFB982]/95 hover:bg-[#DFB982] text-[#241C1A] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 border-2 border-white/40\`,children:(0,I.jsxDEV)(VO,{className:\`w-7 h-7 sm:w-8 sm:h-8 fill-[#241C1A] ml-1\`},void 0,!1,{fileName:Ik,lineNumber:404,columnNumber:15},void 0)},void 0,!1,{fileName:Ik,lineNumber:403,columnNumber:13},void 0),(0,I.jsxDEV)(\`span\`,{className:\`absolute bottom-4 bg-black/75 text-[#DFB982] text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border border-white/20\`,children:\`Tap to Play\`},void 0,!1,{fileName:Ik,lineNumber:406,columnNumber:13},void 0)]},void 0,!0,{fileName:Ik,lineNumber:398,columnNumber:11},void 0),
    w&&!ee&&(0,I.jsxDEV)(\`img\`,{src:w,alt:r||\`Product jewellery showcase\`,className:\`absolute inset-0 w-full h-full object-contain pointer-events-none z-0 transition-opacity duration-500\`,style:{zIndex:1},loading:\`eager\`},void 0,!1,{fileName:Ik,lineNumber:414,columnNumber:11},void 0),
    S&&!ee&&!o&&(0,I.jsxDEV)(\`div\`,{onClick:he,className:\`absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 cursor-pointer p-4 text-center text-white\`,title:\`Click to retry video playback\`,children:[(0,I.jsxDEV)(\`div\`,{className:\`w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center mb-2 transition-transform hover:scale-105 border border-white/30\`,children:(0,I.jsxDEV)(VO,{className:\`w-5 h-5 fill-white ml-0.5\`},void 0,!1,{fileName:Ik,lineNumber:429,columnNumber:15},void 0)},void 0,!1,{fileName:Ik,lineNumber:428,columnNumber:13},void 0),(0,I.jsxDEV)(\`span\`,{className:\`text-xs font-semibold tracking-wider uppercase text-[#DFB982]\`,children:\`Tap to Retry Video\`},void 0,!1,{fileName:Ik,lineNumber:431,columnNumber:13},void 0),(0,I.jsxDEV)(\`span\`,{className:\`text-[10px] text-white/75 mt-1\`,children:\`Preview loading...\`,},void 0,!1,{fileName:Ik,lineNumber:432,columnNumber:13},void 0)]},void 0,!0,{fileName:Ik,lineNumber:423,columnNumber:11},void 0)
  ]},void 0,!0,{fileName:Ik,lineNumber:363,columnNumber:7},void 0)
})`;

replaceExact('SeamlessLoopVideo Lk', oldLkBlock, newLkBlock);

// ============================================================================
// 3. Fix ProductCard.tsx (wN) - Stop infinite spinners & false logo fallbacks
// ============================================================================
const pcStart = bundle.indexOf('wN=({product:e,onOpenQuickView:t,onSelectProduct:n})=>{');
const pcWish = bundle.indexOf('oe&&!y&&(0,I.jsxDEV)(`button`', pcStart);
if (pcStart === -1 || pcWish === -1) {
  throw new Error('Could not locate ProductCard wN media block');
}
const oldPcMedia = bundle.slice(pcStart, pcWish);

const newPcMedia = `wN=({product:e,onOpenQuickView:t,onSelectProduct:n})=>{
  let{addToCart:r,openCart:i}=TD(),{isInWishlist:a,toggleWishlist:o}=kD();
  if(!hE(e))return null;
  let[s,c]=(0,x.useState)(e.variations&&(e?.variations?.length||0)>0?e.variations[0]:void 0),
      [l,u]=(0,x.useState)(!1),
      imgRef=(0,x.useRef)(null);
  (0,x.useEffect)(()=>{e.variations&&(e?.variations?.length||0)>0?c(e.variations[0]):c(void 0)},[e.id]);
  let ee=(Array.isArray(e.images)?e.images.find(x=>!!(x&&typeof x===\`string\`&&x.trim()&&pE(x.trim()))):\`\`)?.trim()
        ||(Array.isArray(e.images)&&e.images[0]?String(e.images[0]).trim():\`\`)
        ||(Array.isArray(e.variations)?e.variations.map(v=>v?.image?.trim()).find(x=>!!(x&&pE(x))):\`\`)||\`\`,
      te=s?.image?.trim(),
      ne=te&&pE(te)?te:ee&&pE(ee)?ee:ee||te||\`\`,
      hasRealImg=!!ne,
      isInstantImg=!hasRealImg||ne.startsWith(\`data:image/\`)||ne.startsWith(\`blob:\`),
      [d,f]=(0,x.useState)(()=>isInstantImg),
      [p,m]=(0,x.useState)(!1),
      [h,g]=(0,x.useState)(!1),
      [_,v]=(0,x.useState)(!0),
      [y,b]=(0,x.useState)(!0);
  (0,x.useEffect)(()=>{
    m(!1),g(!1);
    if(!ne||ne.startsWith(\`data:image/\`)||ne.startsWith(\`blob:\`)){
      f(!0);
      return;
    }
    let el=imgRef.current;
    if(el&&el.complete&&el.src&&!el.src.startsWith(\`data:image/svg+xml\`)){
      if(el.naturalWidth>0){f(!0);return;}
      m(!0);f(!0);return;
    }
    f(!1);
    let timer=setTimeout(()=>f(!0),4500);
    return()=>clearTimeout(timer);
  },[e.id,ne]);
  let re=e.price,S=e.mrp>0?e.mrp:e.price,ie=Pk(S,re),ae=S>re&&ie>0,
      oe=!!(e.videoUrl&&mE(e.videoUrl)),
      se=oe&&y&&!h,
      ce=!p&&ne?ne:Rk,
      le=t=>{t.stopPropagation();let n=s||{id:\`default\`,name:\`Standard\`,colorFinish:\`Default\`,hexCode:\`#D4AF37\`,sku:e.id,stock:e.stock,image:e.images[0]||ne||\`\`,active:!0};r(e,n,1),u(!0),setTimeout(()=>u(!1),1500)},
      ue=t=>{t.stopPropagation();let n=s||{id:\`default\`,name:\`Standard\`,colorFinish:\`Default\`,hexCode:\`#D4AF37\`,sku:e.id,stock:e.stock,image:e.images[0]||ne||\`\`,active:!0};r(e,n,1),i()},
      de=(ev,vObj)=>{ev.stopPropagation(),c(vObj),m(!1),vObj.image&&pE(vObj.image)&&b(!1)};
  (0,x.useEffect)(()=>{
    if(d||se||p||!hasRealImg)return;
    let el=imgRef.current;
    if(el&&el.complete&&el.src&&!el.src.startsWith(\`data:image/svg+xml\`)){
      if(el.naturalWidth>0)f(!0);
      else{m(!0);f(!0);}
    }
  },[d,ne,se,p,hasRealImg]);
  (0,x.useEffect)(()=>{
    if(!se)return;
    if(hasRealImg){f(!0);return;}
    let timer=setTimeout(()=>f(!0),2500);
    return()=>clearTimeout(timer);
  },[se,hasRealImg]);
  return(0,I.jsxDEV)(\`div\`,{onClick:()=>n(e),className:\`group bg-white rounded-xl overflow-hidden border border-[#E8DCCF]/70 hover:border-[#D4AF37]/60 hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer\`,children:[
    (0,I.jsxDEV)(\`div\`,{className:\`relative aspect-[4/5] bg-white overflow-hidden flex items-center justify-center p-3 border-b border-[#F4EBE1]/60\`,children:[
      !d&&!se&&!p&&hasRealImg&&(0,I.jsxDEV)(\`div\`,{className:\`absolute inset-0 bg-[#FAF7F2] animate-pulse flex items-center justify-center z-10\`,children:(0,I.jsxDEV)(\`div\`,{className:\`w-8 h-8 rounded-full border-2 border-[#DFB982]/40 border-t-[#0F5B46] animate-spin\`},void 0,!1,{fileName:CN,lineNumber:141,columnNumber:13},void 0)},void 0,!1,{fileName:CN,lineNumber:140,columnNumber:11},void 0),
      se?(0,I.jsxDEV)(\`div\`,{className:\`relative w-full h-full flex items-center justify-center overflow-hidden bg-white\`,children:[
        (0,I.jsxDEV)(Lk,{src:e.videoUrl,poster:ce,title:e.name,autoPlay:!0,isMuted:_,enableObserver:!0,observerThreshold:.05,onError:()=>{g(!0),f(!0)},onLoadedData:()=>f(!0),onCanPlay:()=>f(!0),className:\`w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500 ease-out\`,style:{width:\`100%\`,height:\`100%\`,objectFit:\`contain\`}},void 0,!1,{fileName:CN,lineNumber:147,columnNumber:13},void 0),
        (0,I.jsxDEV)(\`button\`,{type:\`button\`,onClick:ev=>{ev.stopPropagation(),v(x=>!x)},className:\`absolute top-12 right-3 z-20 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer shadow-md flex items-center justify-center active:scale-90\`,title:_?\`Click to Unmute video\`:\`Click to Mute video\`,"aria-label":_?\`Unmute video audio\`:\`Mute video audio\`,children:_?(0,I.jsxDEV)(xk,{className:\`w-3.5 h-3.5 text-white/90\`},void 0,!1,{fileName:CN,lineNumber:177,columnNumber:17},void 0):(0,I.jsxDEV)(bk,{className:\`w-3.5 h-3.5 text-emerald-400\`},void 0,!1,{fileName:CN,lineNumber:179,columnNumber:17},void 0)},void 0,!1,{fileName:CN,lineNumber:166,columnNumber:13},void 0)
      ]},void 0,!0,{fileName:CN,lineNumber:146,columnNumber:11},void 0):(0,I.jsxDEV)(I.Fragment,{children:[
        (0,I.jsxDEV)(\`img\`,{ref:imgRef,src:ce,alt:e.name,className:\`w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500 ease-out \${d||!hasRealImg||p?\`opacity-100\`:\`opacity-0\`}\`,loading:isInstantImg?\`eager\`:\`lazy\`,onLoad:()=>f(!0),onError:()=>{m(!0),f(!0)}},void 0,!1,{fileName:CN,lineNumber:184,columnNumber:11},void 0),
        p&&(0,I.jsxDEV)(\`span\`,{className:\`absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 text-[#802336] text-[10px] font-semibold px-2 py-0.5 rounded border border-[#E8DCCF] shadow-xs pointer-events-none whitespace-nowrap\`,children:\`Image Unavailable\`},void 0,!1,{fileName:CN,lineNumber:195,columnNumber:13},void 0)
      ]},void 0,!0,{fileName:CN,lineNumber:183,columnNumber:11},void 0),
      (0,I.jsxDEV)(\`div\`,{className:\`absolute top-3 left-3 flex flex-col gap-1 z-10 pointer-events-none\`,children:[
        oe&&(0,I.jsxDEV)(\`span\`,{className:\`bg-[#0F5C4D] text-[#FAF7F2] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm flex items-center gap-1\`,children:[(0,I.jsxDEV)(\`span\`,{className:\`w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse\`},void 0,!1,{fileName:CN,lineNumber:203,columnNumber:15},void 0),(0,I.jsxDEV)(\`span\`,{children:\`360° Reel\`},void 0,!1,{fileName:CN,lineNumber:204,columnNumber:15},void 0)]},void 0,!0,{fileName:CN,lineNumber:202,columnNumber:13},void 0),
        e.isBestseller&&(0,I.jsxDEV)(\`span\`,{className:\`bg-[#802336] text-[#FAF7F2] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm\`,children:\`Bestseller\`},void 0,!1,{fileName:CN,lineNumber:208,columnNumber:13},void 0),
        e.isNewArrival&&(0,I.jsxDEV)(\`span\`,{className:\`bg-[#3B1E22] text-[#DFB982] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm\`,children:\`New Arrival\`},void 0,!1,{fileName:CN,lineNumber:213,columnNumber:13},void 0),
        ae&&(0,I.jsxDEV)(\`span\`,{className:\`bg-[#D4AF37] text-[#3B1E22] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm\`,children:[ie,\`% OFF\`]},void 0,!0,{fileName:CN,lineNumber:218,columnNumber:13},void 0)
      ]},void 0,!0,{fileName:CN,lineNumber:200,columnNumber:9},void 0),`;

replaceExact('ProductCard wN media & spinner fix', oldPcMedia, newPcMedia);

// ============================================================================
// 4. Fix ShopByVideoSection.tsx (PN & FN) - Fix missing z-[1], unstable ref, el.load()
// ============================================================================
const pStart = bundle.indexOf('uN=e=>{if(!e||typeof e!=`string`)return``;');
const fnEnd = bundle.indexOf(',H=`/app/applet/src/views/HomeView.tsx`', pStart);
if (pStart === -1 || fnEnd === -1) {
  throw new Error('Could not locate ShopByVideoSection uN/PN/FN block');
}
const oldShopByVid = bundle.slice(pStart, fnEnd);

const newShopByVid = `uN=e=>{if(!e||typeof e!=\`string\`)return\`\`;let t=e.trim().replace(/^https?:\\/\\/(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?(\\/.*)$/i,\`$1\`);return/^videos\\/uploads\\//i.test(t)?\`/\${t}\`:t},
PN=({videoUrl:e,fallbackImage:t,title:n,isMuted:r=!0,isActive:i=!0})=>{
  let v=(0,x.useRef)(null),
      boxRef=(0,x.useRef)(null),
      cleanSrc=uN(e),
      prevSrc=(0,x.useRef)(cleanSrc),
      [hasErr,setHasErr]=(0,x.useState)(!1),
      [playing,setPlaying]=(0,x.useState)(!1),
      [ready,setReady]=(0,x.useState)(!1),
      [inView,setInView]=(0,x.useState)(!0),
      validFallback=(t&&typeof t===\`string\`&&t.trim()&&!t.startsWith(\`data:image/svg+xml\`))?t:\`\`;

  let tryPlay=(0,x.useCallback)(()=>{
    let el=v.current;
    if(!el||!cleanSrc)return;
    try{
      el.muted=r;
      el.defaultMuted=r;
      r?el.setAttribute(\`muted\`,\`\`):el.removeAttribute(\`muted\`);
      el.playsInline=!0;
      el.setAttribute(\`playsinline\`,\`\`);
      el.setAttribute(\`webkit-playsinline\`,\`true\`);
      let p=el.play();
      p!==void 0&&p.then(()=>{setPlaying(!0);setHasErr(!1);}).catch(err=>{
        if(err?.name===\`NotAllowedError\`||!el.muted){
          el.muted=!0;
          el.defaultMuted=!0;
          el.setAttribute(\`muted\`,\`\`);
          let p2=el.play();
          p2!==void 0&&p2.then(()=>{setPlaying(!0);setHasErr(!1);}).catch(()=>{});
        }
      });
    }catch{}
  },[r,cleanSrc]);

  (0,x.useEffect)(()=>{
    let el=v.current;
    if(!el)return;
    el.muted=r;
    el.defaultMuted=r;
    r?el.setAttribute(\`muted\`,\`\`):el.removeAttribute(\`muted\`);
    el.playsInline=!0;
    el.setAttribute(\`playsinline\`,\`\`);
    el.setAttribute(\`webkit-playsinline\`,\`true\`);
    if(inView&&el.paused)tryPlay();
  },[r,inView,tryPlay]);

  (0,x.useEffect)(()=>{
    setHasErr(!1);setReady(!1);setPlaying(!1);
    let el=v.current;
    if(el&&cleanSrc){
      if(prevSrc.current!==cleanSrc){
        prevSrc.current=cleanSrc;
        try{el.load()}catch{}
      }
      if(inView)tryPlay();
    }
  },[cleanSrc]);

  (0,x.useEffect)(()=>{
    let box=boxRef.current||v.current;
    if(!box||typeof IntersectionObserver>\`u\`)return setInView(!0);
    let obs=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        let vis=entry.isIntersecting||entry.intersectionRatio>0;
        setInView(vis);
        let el=v.current;
        if(el){
          if(vis){if(el.paused)tryPlay();}
          else if(!el.paused){try{el.pause();setPlaying(!1);}catch{}}
        }
      });
    },{threshold:[0,.05,.2],rootMargin:\`200px 350px 200px 350px\`});
    obs.observe(box);
    return()=>obs.disconnect();
  },[tryPlay]);

  (0,x.useEffect)(()=>{
    if(!inView)return;
    let resume=()=>{let el=v.current;if(el&&el.paused&&inView)tryPlay();};
    let onVis=()=>{if(document.visibilityState===\`visible\`)resume();};
    window.addEventListener(\`touchstart\`,resume,{passive:!0});
    window.addEventListener(\`pointerdown\`,resume,{passive:!0});
    document.addEventListener(\`visibilitychange\`,onVis);
    return()=>{
      window.removeEventListener(\`touchstart\`,resume);
      window.removeEventListener(\`pointerdown\`,resume);
      document.removeEventListener(\`visibilitychange\`,onVis);
    };
  },[inView,tryPlay]);

  return(0,I.jsxDEV)(\`div\`,{
    ref:boxRef,
    className:\`absolute inset-0 w-full h-full overflow-hidden bg-black select-none\`,
    children:[
      (0,I.jsxDEV)(\`video\`,{
        ref:v,
        src:cleanSrc||void 0,
        poster:validFallback||void 0,
        autoPlay:!0,
        muted:r,
        loop:!0,
        playsInline:!0,
        "webkit-playsinline":\`true\`,
        preload:\`auto\`,
        title:n,
        onLoadedMetadata:()=>{setReady(!0);if(inView)tryPlay();},
        onLoadedData:()=>{setReady(!0);setHasErr(!1);if(inView)tryPlay();},
        onCanPlay:()=>{setReady(!0);setHasErr(!1);if(inView)tryPlay();},
        onPlaying:()=>{setPlaying(!0);setReady(!0);setHasErr(!1);},
        onPlay:()=>{setPlaying(!0);setHasErr(!1);},
        onPause:()=>setPlaying(!1),
        onError:()=>{let el=v.current;if(!el||el.readyState===0)setHasErr(!0);},
        className:\`w-full h-full object-cover select-none block\`,
        style:{width:\`100%\`,height:\`100%\`,objectFit:\`cover\`,position:\`relative\`,zIndex:2,opacity:hasErr&&validFallback?0:1},
        "aria-hidden":\`true\`,
        tabIndex:-1
      },void 0,!1,{fileName:NN,lineNumber:60,columnNumber:7},void 0),
      validFallback&&(!ready||hasErr)&&!playing&&(0,I.jsxDEV)(\`img\`,{
        src:validFallback,
        alt:n||\`VIDHYAA Jewellery\`,
        className:\`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300\`,
        style:{zIndex:1},
        loading:\`eager\`
      },void 0,!1,{fileName:NN,lineNumber:58,columnNumber:9},void 0),
      hasErr&&(0,I.jsxDEV)(\`button\`,{
        type:\`button\`,
        onClick:ev=>{ev.stopPropagation();setHasErr(!1);let el=v.current;if(el){try{el.load()}catch{}tryPlay();}},
        className:\`absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white z-10 cursor-pointer\`,
        children:[
          (0,I.jsxDEV)(\`div\`,{className:\`w-12 h-12 rounded-full bg-[#DFB982]/90 text-[#241C1A] flex items-center justify-center shadow-lg mb-1.5\`,children:(0,I.jsxDEV)(VO,{className:\`w-5 h-5 fill-[#241C1A] ml-0.5\`},void 0,!1,{fileName:NN,lineNumber:62,columnNumber:11},void 0)},void 0,!1,{fileName:NN,lineNumber:62,columnNumber:9},void 0),
          (0,I.jsxDEV)(\`span\`,{className:\`text-[11px] font-semibold tracking-wider uppercase text-[#DFB982]\`,children:\`Tap to Play Video\`},void 0,!1,{fileName:NN,lineNumber:63,columnNumber:9},void 0)
        ]
      },void 0,!0,{fileName:NN,lineNumber:61,columnNumber:7},void 0)
    ]
  },void 0,!0,{fileName:NN,lineNumber:59,columnNumber:5},void 0);
};
var FN=({products:e,onSelectProduct:t})=>{
  let{addToCart:n,openCart:r}=TD(),
      trackRef=(0,x.useRef)(null),
      reels=(0,x.useMemo)(()=>{
        let normList=(Array.isArray(e)?e:[]).map(p=>{
          let v=uN(p.videoUrl||p.video||p.videoURL||\'\');
          return v?{...p,videoUrl:v}:p;
        });
        let list=normList.filter(p=>!!(p.videoUrl&&mE(p.videoUrl)&&!fE.has(p.id)&&p.showInShoppingVideos!==!1)).map(p=>{
          let thumb=(p.images||[]).find(pE)||(p.variations||[]).map(v=>v?.image).find(pE)||\'\';
          return{
            id:\`reel-\${p.id}\`,
            title:p.name,
            category:p.categoryName||\'Fine Jewellery\',
            price:p.price,
            mrp:p.mrp,
            discount:p.discountPercent,
            videoUrl:uN(p.videoUrl),
            posterImage:thumb,
            duration:\'0:15\',
            features:p.shortDescription||p.description?.slice(0,70)||\`₹\${p.price.toLocaleString(\'en-IN\')}\`,
            productId:p.id,
            rawProduct:p
          };
        });
        let seen=new Set(list.map(x=>x.productId));
        let fallback=_E.filter(p=>!!(p.videoUrl&&mE(p.videoUrl)&&!seen.has(p.id)&&p.showInShoppingVideos!==!1)).map(p=>{
          let thumb=(p.images||[]).find(pE)||(p.variations||[]).map(v=>v?.image).find(pE)||\'\';
          return{
            id:\`reel-\${p.id}\`,
            title:p.name,
            category:p.categoryName||\'Fine Jewellery\',
            price:p.price,
            mrp:p.mrp,
            discount:p.discountPercent,
            videoUrl:uN(p.videoUrl),
            posterImage:thumb,
            duration:\'0:15\',
            features:p.shortDescription||p.description?.slice(0,70)||\`₹\${p.price.toLocaleString(\'en-IN\')}\`,
            productId:p.id,
            rawProduct:p
          };
        });
        return[...list,...fallback];
      },[e]),
      [activeSlide,setActiveSlide]=(0,x.useState)(0),
      [mutedId,setMutedId]=(0,x.useState)(null),
      [modalIdx,setModalIdx]=(0,x.useState)(null),
      [modalPlaying,setModalPlaying]=(0,x.useState)(!0),
      [modalMuted,setModalMuted]=(0,x.useState)(!0),
      [addedId,setAddedId]=(0,x.useState)(null),
      modalVideoRef=(0,x.useRef)(null);
  let getProduct=(reel)=>{
    if(reel.rawProduct)return reel.rawProduct;
    if(reel.productId){let found=e.find(p=>p.id===reel.productId);if(found)return found;}
    let bareId=reel.id.replace(/^reel-/,\'\');
    return e.find(p=>p.id===bareId)||e[0];
  };
  let handleSelectProduct=(reel)=>{let prod=getProduct(reel);setModalIdx(null);t(prod);};
  let handleQuickAdd=(reel)=>{
    let prod=getProduct(reel);
    let variation=prod.variations?.[0]||{id:\`\${prod.id}-var-1\`,name:\'Standard Finish\',colorFinish:\'Gold\',hexCode:\'#D4AF37\',sku:\`VDH-\${prod.id}\`,price:prod.price,mrp:prod.mrp,stock:10,image:reel.posterImage,active:!0};
    n(prod,variation,1);setAddedId(reel.id);MN({particleCount:50,spread:60,origin:{y:.6}});setTimeout(()=>setAddedId(null),2500);r();
  };
  let scrollToSlide=(idx)=>{
    let clamped=(idx+reels.length)%reels.length;
    setActiveSlide(clamped);
    let track=trackRef.current;
    if(track&&track.children&&track.children[clamped]){track.children[clamped].scrollIntoView({behavior:\'smooth\',inline:\'center\',block:\'nearest\'});}
  };
  let scrollDir=(dir)=>{let nextIdx=dir===\'left\'?(activeSlide-1+reels.length)%reels.length:(activeSlide+1)%reels.length;scrollToSlide(nextIdx);};
  let onTrackScroll=(0,x.useCallback)(()=>{
    let el=trackRef.current;
    if(!el||!el.children||el.children.length===0)return;
    let trackRect=el.getBoundingClientRect(),trackCenter=trackRect.left+trackRect.width/2,closestIdx=0,closestDist=Infinity;
    for(let k=0;k<el.children.length;k++){
      let r=el.children[k].getBoundingClientRect(),center=r.left+r.width/2,dist=Math.abs(trackCenter-center);
      if(dist<closestDist){closestDist=dist;closestIdx=k;}
    }
    if(closestIdx!==activeSlide)setActiveSlide(closestIdx);
  },[activeSlide]);
  (0,x.useEffect)(()=>{
    let onKey=(evt)=>{if(modalIdx!==null&&reels.length!==0){if(evt.key===\'Escape\')setModalIdx(null);if(evt.key===\'ArrowRight\')setModalIdx((modalIdx+1)%reels.length);if(evt.key===\'ArrowLeft\')setModalIdx((modalIdx-1+reels.length)%reels.length);}};
    window.addEventListener(\'keydown\',onKey);
    return()=>window.removeEventListener(\'keydown\',onKey);
  },[modalIdx,reels.length]);
  if(reels.length===0){
    return(0,I.jsxDEV)(\'section\',{
      id:\'shopping-video\',
      className:\'relative overflow-hidden py-14 bg-[#FAF7F2] border-y border-[#E8DCCF]\',
      children:(0,I.jsxDEV)(\'div\',{
        className:\'max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4\',
        children:[
          (0,I.jsxDEV)(\'div\',{className:\'inline-flex items-center gap-2 bg-[#E8DCCF]/60 text-[#802336] text-[11px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-[#DFB982]/40\',children:[(0,I.jsxDEV)(ak,{className:\'w-3.5 h-3.5 text-[#B8860B]\'},void 0,!1,{fileName:NN,lineNumber:262,columnNumber:13},void 0),(0,I.jsxDEV)(\'span\',{children:\'Studio Video Demonstrations\'},void 0,!1,{fileName:NN,lineNumber:263,columnNumber:13},void 0)]},void 0,!0,{fileName:NN,lineNumber:261,columnNumber:11},void 0),
          (0,I.jsxDEV)(\'h2\',{className:\'font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]\',children:\'Craftsmanship in Motion\'},void 0,!1,{fileName:NN,lineNumber:265,columnNumber:11},void 0),
          (0,I.jsxDEV)(\'p\',{className:\'text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed\',children:\'High-definition 360° video showcases and reel demonstrations will appear here once videos are uploaded.\'},void 0,!1,{fileName:NN,lineNumber:268,columnNumber:11},void 0)
        ]
      },void 0,!0,{fileName:NN,lineNumber:260,columnNumber:9},void 0)
    },void 0,!1,{fileName:NN,lineNumber:259,columnNumber:7},void 0);
  }
  let activeModalReel=modalIdx===null?null:reels[modalIdx];
  return(0,I.jsxDEV)(\'section\',{
    id:\'shopping-video\',
    className:\'relative overflow-hidden py-16 sm:py-20 bg-[#FAF7F2] border-y border-[#E8DCCF]\',
    children:[
      (0,I.jsxDEV)(\'div\',{className:\'absolute inset-0 bg-radial from-white/80 via-[#FAF7F2]/95 to-[#FAF7F2] pointer-events-none\'},void 0,!1,{fileName:NN,lineNumber:292,columnNumber:7},void 0),
      (0,I.jsxDEV)(\'div\',{className:\'absolute top-0 right-1/4 w-96 h-96 bg-[#DFB982]/10 rounded-full blur-3xl pointer-events-none\'},void 0,!1,{fileName:NN,lineNumber:293,columnNumber:7},void 0),
      (0,I.jsxDEV)(\'div\',{className:\'absolute bottom-0 left-1/4 w-96 h-96 bg-[#FAF7F2] rounded-full blur-3xl pointer-events-none\'},void 0,!1,{fileName:NN,lineNumber:294,columnNumber:7},void 0),
      (0,I.jsxDEV)(\'div\',{
        className:\'relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8\',
        children:[
          (0,I.jsxDEV)(\'div\',{
            className:\'flex flex-col md:flex-row md:items-end justify-between gap-6 text-center md:text-left\',
            children:[
              (0,I.jsxDEV)(\'div\',{
                className:\'space-y-2 max-w-2xl mx-auto md:mx-0\',
                children:[
                  (0,I.jsxDEV)(\'div\',{className:\'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DFB982]/20 border border-[#DFB982]/40 text-[#802336] text-[11px] font-bold uppercase tracking-widest\',children:[(0,I.jsxDEV)(ak,{className:\'w-3 h-3 text-[#B8860B]\'},void 0,!1,{fileName:NN,lineNumber:301,columnNumber:15},void 0),(0,I.jsxDEV)(\'span\',{children:\'Discover Our Jewellery in Motion\'},void 0,!1,{fileName:NN,lineNumber:302,columnNumber:15},void 0)]},void 0,!0,{fileName:NN,lineNumber:300,columnNumber:13},void 0),
                  (0,I.jsxDEV)(\'h2\',{className:\'font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#241C1A] tracking-tight\',children:\'SHOPPING VIDEO\'},void 0,!1,{fileName:NN,lineNumber:305,columnNumber:13},void 0),
                  (0,I.jsxDEV)(\'p\',{className:\'text-xs sm:text-sm text-[#5C4D4A] leading-relaxed font-normal\',children:\'Experience the unmatched brilliance, movement, and intricate hand-carved detailing of our regal Indian jewellery in dynamic portrait reels.\'},void 0,!1,{fileName:NN,lineNumber:309,columnNumber:13},void 0)
                ]
              },void 0,!0,{fileName:NN,lineNumber:299,columnNumber:11},void 0),
              (0,I.jsxDEV)(\'div\',{
                className:\'hidden sm:flex items-center justify-center gap-2.5\',
                children:[
                  (0,I.jsxDEV)(\'button\',{onClick:()=>scrollDir(\'left\'),className:\'w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer\',title:\'Previous video\',\'aria-label\':\'Previous video\',children:(0,I.jsxDEV)(qD,{className:\'w-5 h-5\'},void 0,!1,{fileName:NN,lineNumber:322,columnNumber:15},void 0)},void 0,!1,{fileName:NN,lineNumber:316,columnNumber:13},void 0),
                  (0,I.jsxDEV)(\'button\',{onClick:()=>scrollDir(\'right\'),className:\'w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer\',title:\'Next video\',\'aria-label\':\'Next video\',children:(0,I.jsxDEV)(JD,{className:\'w-5 h-5\'},void 0,!1,{fileName:NN,lineNumber:331,columnNumber:15},void 0)},void 0,!1,{fileName:NN,lineNumber:325,columnNumber:13},void 0)
                ]
              },void 0,!0,{fileName:NN,lineNumber:315,columnNumber:11},void 0)
            ]
          },void 0,!0,{fileName:NN,lineNumber:298,columnNumber:9},void 0),
          (0,I.jsxDEV)(\'div\',{
            ref:trackRef,
            onScroll:onTrackScroll,
            className:\'flex gap-5 sm:gap-6 overflow-x-auto pb-4 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0\',
            children:reels.map((reel,idx)=>{
              let isCurrent=idx===activeSlide;
              let isSoundOn=mutedId===reel.id;
              return(0,I.jsxDEV)(\'div\',{
                key:reel.id,
                onClick:()=>{if(activeSlide!==idx)scrollToSlide(idx);},
                className:\`group relative flex-none w-[76vw] xs:w-[68vw] sm:w-[290px] lg:w-[310px] aspect-[9/16] snap-center rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 \${isCurrent?\'ring-2 ring-[#DFB982] shadow-2xl scale-[1.01]\':\'ring-1 ring-[#E8DCCF]/80 shadow-md opacity-90 hover:opacity-100 hover:ring-[#DFB982]/60\'}\`,
                children:[
                  (0,I.jsxDEV)(PN,{videoUrl:reel.videoUrl,fallbackImage:reel.posterImage,title:reel.title,isMuted:!isSoundOn,isActive:isCurrent},void 0,!1,{fileName:NN,lineNumber:350,columnNumber:17},void 0),
                  (0,I.jsxDEV)(\'div\',{className:\'absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35 pointer-events-none z-10\'},void 0,!1,{fileName:NN,lineNumber:358,columnNumber:17},void 0),
                  (0,I.jsxDEV)(\'div\',{
                    className:\'absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-20\',
                    children:[
                      (0,I.jsxDEV)(\'div\',{
                        className:\'flex items-center gap-1.5 pointer-events-none\',
                        children:[
                          (0,I.jsxDEV)(\'span\',{className:\'bg-white/90 backdrop-blur-md text-[#802336] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs border border-[#E8DCCF]\',children:reel.category},void 0,!1,{fileName:NN,lineNumber:363,columnNumber:21},void 0),
                          (0,I.jsxDEV)(\'span\',{className:\'bg-black/50 backdrop-blur-md text-white text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20\',children:[(0,I.jsxDEV)(\'span\',{className:\'w-1.5 h-1.5 rounded-full bg-red-500 animate-ping\'},void 0,!1,{fileName:NN,lineNumber:368,columnNumber:23},void 0),(0,I.jsxDEV)(\'span\',{children:reel.duration},void 0,!1,{fileName:NN,lineNumber:369,columnNumber:23},void 0)]},void 0,!0,{fileName:NN,lineNumber:367,columnNumber:21},void 0)
                        ]
                      },void 0,!0,{fileName:NN,lineNumber:362,columnNumber:19},void 0),
                      (0,I.jsxDEV)(\'button\',{
                        type:\'button\',
                        onClick:evt=>{evt.stopPropagation();setMutedId(mutedId===reel.id?null:reel.id);},
                        className:\'w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/25 shadow-md active:scale-90\',
                        title:isSoundOn?\'Click to Mute\':\'Click to Unmute Sound\',
                        \'aria-label\':isSoundOn?\'Mute video sound\':\'Unmute video sound\',
                        children:isSoundOn?(0,I.jsxDEV)(bk,{className:\'w-4 h-4 text-emerald-400\'},void 0,!1,{fileName:NN,lineNumber:385,columnNumber:23},void 0):(0,I.jsxDEV)(xk,{className:\'w-4 h-4 text-white/90\'},void 0,!1,{fileName:NN,lineNumber:387,columnNumber:23},void 0)
                      },void 0,!1,{fileName:NN,lineNumber:374,columnNumber:19},void 0)
                    ]
                  },void 0,!0,{fileName:NN,lineNumber:361,columnNumber:17},void 0),
                  (0,I.jsxDEV)(\'div\',{
                    onClick:evt=>{evt.stopPropagation();handleSelectProduct(reel);},
                    className:\'absolute bottom-3 inset-x-3 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-[#DFB982]/50 z-20 flex items-center gap-2.5 transition-all duration-300 hover:bg-white\',
                    children:[
                      reel.posterImage&&(0,I.jsxDEV)(\'img\',{src:reel.posterImage,alt:reel.title,className:\'w-12 h-12 rounded-xl object-cover border border-[#E8DCCF] flex-shrink-0 bg-white\',loading:\'lazy\'},void 0,!1,{fileName:NN,lineNumber:395,columnNumber:21},void 0),
                      (0,I.jsxDEV)(\'div\',{
                        className:\'flex-1 min-w-0 pr-1\',
                        children:[
                          (0,I.jsxDEV)(\'h4\',{className:\'font-serif text-xs sm:text-sm font-bold text-[#241C1A] truncate leading-tight group-hover:text-[#802336] transition-colors\',children:reel.title},void 0,!1,{fileName:NN,lineNumber:400,columnNumber:23},void 0),
                          (0,I.jsxDEV)(\'div\',{
                            className:\'flex items-baseline gap-1.5 pt-0.5 flex-wrap\',
                            children:[
                              (0,I.jsxDEV)(\'span\',{className:\'text-xs sm:text-sm font-bold text-[#802336]\',children:Nk(reel.price)},void 0,!1,{fileName:NN,lineNumber:405,columnNumber:25},void 0),
                              reel.mrp>reel.price&&(0,I.jsxDEV)(I.Fragment,{children:[(0,I.jsxDEV)(\'span\',{className:\'text-[10px] text-gray-400 line-through\',children:Nk(reel.mrp)},void 0,!1,{fileName:NN,lineNumber:410,columnNumber:29},void 0),(0,I.jsxDEV)(\'span\',{className:\'text-[9px] bg-[#802336] text-white px-1 py-0.2 rounded font-bold\',children:[Pk(reel.mrp,reel.price),\'% OFF\']},void 0,!0,{fileName:NN,lineNumber:415,columnNumber:29},void 0)]},void 0,!0,{fileName:NN,lineNumber:409,columnNumber:25},void 0)
                            ]
                          },void 0,!0,{fileName:NN,lineNumber:404,columnNumber:23},void 0)
                        ]
                      },void 0,!0,{fileName:NN,lineNumber:399,columnNumber:21},void 0),
                      (0,I.jsxDEV)(\'button\',{
                        type:\'button\',
                        onClick:evt=>{evt.stopPropagation();handleSelectProduct(reel);},
                        className:\'btn-teak-green py-2 px-2.5 sm:px-3 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-xs hover:shadow flex-shrink-0\',
                        children:[(0,I.jsxDEV)(\'span\',{children:\'SHOP NOW\'},void 0,!1,{fileName:NN,lineNumber:425,columnNumber:25},void 0),(0,I.jsxDEV)(BD,{className:\'w-3 h-3 text-white\'},void 0,!1,{fileName:NN,lineNumber:426,columnNumber:25},void 0)]
                      },void 0,!0,{fileName:NN,lineNumber:424,columnNumber:21},void 0)
                    ]
                  },void 0,!0,{fileName:NN,lineNumber:393,columnNumber:19},void 0)
                ]
              },reel.id,!0,{fileName:NN,lineNumber:342,columnNumber:13},void 0);
            })
          },void 0,!1,{fileName:NN,lineNumber:337,columnNumber:9},void 0),
          reels.length>1&&(0,I.jsxDEV)(\'div\',{
            className:\'flex items-center justify-center gap-2 pt-2\',
            children:reels.map((reel,dotIdx)=>(0,I.jsxDEV)(\'button\',{key:\`dot-\${reel.id}\`,type:\'button\',onClick:()=>scrollToSlide(dotIdx),className:\`transition-all duration-300 cursor-pointer rounded-full \${dotIdx===activeSlide?\'w-7 h-2 bg-[#802336]\':\'w-2 h-2 bg-[#E8DCCF] hover:bg-[#DFB982]\'}\`,title:\`Go to slide \${dotIdx+1}\`,\'aria-label\':\`Go to slide \${dotIdx+1}\`},void 0,!1,{fileName:NN,lineNumber:440,columnNumber:15},void 0))
          },void 0,!1,{fileName:NN,lineNumber:438,columnNumber:9},void 0),
          (0,I.jsxDEV)(\'div\',{className:\'sm:hidden text-center text-[11px] text-[#802336] font-semibold flex items-center justify-center gap-1.5\',children:(0,I.jsxDEV)(\'span\',{children:\'← Swipe to explore more jewellery reels →\'},void 0,!1,{fileName:NN,lineNumber:453,columnNumber:11},void 0)},void 0,!1,{fileName:NN,lineNumber:452,columnNumber:9},void 0)
        ]
      },void 0,!0,{fileName:NN,lineNumber:296,columnNumber:7},void 0),
      activeModalReel&&(0,I.jsxDEV)(\'div\',{
        className:\'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn\',
        onClick:()=>setModalIdx(null),
        children:(0,I.jsxDEV)(\'div\',{
          className:\'relative w-full max-w-4xl bg-[#FAF7F2] rounded-3xl overflow-hidden shadow-2xl border border-[#DFB982]/50 flex flex-col md:flex-row max-h-[92vh]\',
          onClick:evt=>evt.stopPropagation(),
          children:[
            (0,I.jsxDEV)(\'button\',{onClick:()=>setModalIdx(null),className:\'absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer\',title:\'Close video viewer (Esc)\',\'aria-label\':\'Close video viewer\',children:(0,I.jsxDEV)(Sk,{className:\'w-5 h-5\'},void 0,!1,{fileName:NN,lineNumber:477,columnNumber:15},void 0)},void 0,!1,{fileName:NN,lineNumber:471,columnNumber:13},void 0),
            (0,I.jsxDEV)(\'div\',{
              className:\'relative md:w-3/5 bg-black flex items-center justify-center overflow-hidden select-none\',
              children:[
                (0,I.jsxDEV)(\'div\',{
                  className:\'relative w-full h-full max-h-[550px] md:max-h-[640px] flex items-center justify-center cursor-pointer\',
                  onClick:()=>{let vEl=modalVideoRef.current;if(vEl){if(modalPlaying){vEl.pause();setModalPlaying(!1);}else{vEl.play().catch(()=>{});setModalPlaying(!0);}}},
                  children:[
                    (0,I.jsxDEV)(Lk,{ref:modalVideoRef,src:activeModalReel.videoUrl,poster:void 0,fallbackImage:activeModalReel.posterImage,title:activeModalReel.title,autoPlay:!0,isMuted:modalMuted,enableObserver:!1,showPlayButtonFallback:!0,className:\'w-full h-full max-h-[550px] md:max-h-[640px] object-contain select-none\',style:{width:\'100%\',height:\'100%\',objectFit:\'contain\'}},activeModalReel.id,!1,{fileName:NN,lineNumber:486,columnNumber:17},void 0),
                    !modalPlaying&&(0,I.jsxDEV)(\'div\',{className:\'absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none\',children:(0,I.jsxDEV)(\'div\',{className:\'w-16 h-16 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/20 text-[#DFB982]\',children:(0,I.jsxDEV)(VO,{className:\'w-8 h-8 fill-[#DFB982] ml-1\'},void 0,!1,{fileName:NN,lineNumber:504,columnNumber:23},void 0)},void 0,!1,{fileName:NN,lineNumber:503,columnNumber:21},void 0)},void 0,!1,{fileName:NN,lineNumber:502,columnNumber:19},void 0),
                    (0,I.jsxDEV)(\'button\',{onClick:evt=>{evt.stopPropagation();if(modalVideoRef.current){let isM=modalVideoRef.current.toggleMute();setModalMuted(isM);}else setModalMuted(!modalMuted);},className:\'absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20\',title:modalMuted?\'Click to Unmute\':\'Click to Mute\',children:modalMuted?(0,I.jsxDEV)(xk,{className:\'w-4 h-4 text-red-300\'},void 0,!1,{fileName:NN,lineNumber:520,columnNumber:21},void 0):(0,I.jsxDEV)(bk,{className:\'w-4 h-4 text-emerald-400\'},void 0,!1,{fileName:NN,lineNumber:522,columnNumber:21},void 0)},void 0,!1,{fileName:NN,lineNumber:510,columnNumber:17},void 0)
                  ]
                },void 0,!0,{fileName:NN,lineNumber:482,columnNumber:15},void 0),
                (0,I.jsxDEV)(\'div\',{className:\'absolute bottom-4 left-4 z-20 pointer-events-none\',children:(0,I.jsxDEV)(\'div\',{className:\'bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono border border-white/20 text-[#DFB982]\',children:[modalIdx+1,\' / \',reels.length]},void 0,!0,{fileName:NN,lineNumber:529,columnNumber:17},void 0)},void 0,!1,{fileName:NN,lineNumber:528,columnNumber:15},void 0),
                (0,I.jsxDEV)(\'button\',{onClick:evt=>{evt.stopPropagation();setModalIdx((modalIdx-1+reels.length)%reels.length);},className:\'absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20\',title:\'Previous jewellery reel\',children:(0,I.jsxDEV)(qD,{className:\'w-5 h-5\'},void 0,!1,{fileName:NN,lineNumber:543,columnNumber:17},void 0)},void 0,!1,{fileName:NN,lineNumber:535,columnNumber:15},void 0),
                (0,I.jsxDEV)(\'button\',{onClick:evt=>{evt.stopPropagation();setModalIdx((modalIdx+1)%reels.length);},className:\'absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20\',title:\'Next jewellery reel\',children:(0,I.jsxDEV)(JD,{className:\'w-5 h-5\'},void 0,!1,{fileName:NN,lineNumber:554,columnNumber:17},void 0)},void 0,!1,{fileName:NN,lineNumber:546,columnNumber:15},void 0)
              ]
            },void 0,!0,{fileName:NN,lineNumber:481,columnNumber:13},void 0),
            (0,I.jsxDEV)(\'div\',{
              className:\'md:w-2/5 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-white overflow-y-auto\',
              children:[
                (0,I.jsxDEV)(\'div\',{
                  className:\'space-y-4\',
                  children:[
                    (0,I.jsxDEV)(\'div\',{className:\'flex items-center gap-2\',children:[(0,I.jsxDEV)(\'span\',{className:\'bg-[#DFB982]/20 text-[#802336] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider\',children:activeModalReel.category},void 0,!1,{fileName:NN,lineNumber:562,columnNumber:19},void 0),(0,I.jsxDEV)(\'div\',{className:\'flex items-center gap-1 text-[#B8860B] text-xs font-semibold\',children:[(0,I.jsxDEV)(sk,{className:\'w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]\'},void 0,!1,{fileName:NN,lineNumber:566,columnNumber:21},void 0),(0,I.jsxDEV)(\'span\',{children:\'4.9 / 5.0 Rating\'},void 0,!1,{fileName:NN,lineNumber:567,columnNumber:21},void 0)]},void 0,!0,{fileName:NN,lineNumber:565,columnNumber:19},void 0)]},void 0,!0,{fileName:NN,lineNumber:561,columnNumber:17},void 0),
                    (0,I.jsxDEV)(\'div\',{children:[(0,I.jsxDEV)(\'h3\',{className:\'font-serif text-xl sm:text-2xl font-bold text-[#241C1A]\',children:activeModalReel.title},void 0,!1,{fileName:NN,lineNumber:572,columnNumber:19},void 0),(0,I.jsxDEV)(\'p\',{className:\'text-xs text-[#5C4D4A] mt-1.5 leading-relaxed\',children:activeModalReel.features},void 0,!1,{fileName:NN,lineNumber:575,columnNumber:19},void 0)]},void 0,!0,{fileName:NN,lineNumber:571,columnNumber:17},void 0),
                    (0,I.jsxDEV)(\'div\',{className:\'p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E8DCCF] space-y-1\',children:[(0,I.jsxDEV)(\'div\',{className:\'flex items-baseline gap-2 flex-wrap\',children:[(0,I.jsxDEV)(\'span\',{className:\'text-2xl font-serif font-bold text-[#802336]\',children:Nk(activeModalReel.price)},void 0,!1,{fileName:NN,lineNumber:582,columnNumber:21},void 0),activeModalReel.mrp>activeModalReel.price&&(0,I.jsxDEV)(I.Fragment,{children:[(0,I.jsxDEV)(\'span\',{className:\'text-sm text-gray-400 line-through\',children:Nk(activeModalReel.mrp)},void 0,!1,{fileName:NN,lineNumber:587,columnNumber:25},void 0),(0,I.jsxDEV)(\'span\',{className:\'text-xs bg-[#D4AF37] text-[#3B1E22] font-bold px-2 py-0.5 rounded shadow-xs uppercase tracking-wider\',children:[Pk(activeModalReel.mrp,activeModalReel.price),\'% OFF\']},void 0,!0,{fileName:NN,lineNumber:590,columnNumber:25},void 0)]},void 0,!0,{fileName:NN,lineNumber:586,columnNumber:23},void 0)]},void 0,!0,{fileName:NN,lineNumber:581,columnNumber:19},void 0),(0,I.jsxDEV)(\'span\',{className:\'text-[11px] text-emerald-700 font-medium block\',children:\'✓ In Stock • Insured Express Dispatch from Atelier\'},void 0,!1,{fileName:NN,lineNumber:596,columnNumber:19},void 0)]},void 0,!0,{fileName:NN,lineNumber:580,columnNumber:17},void 0),
                    (0,I.jsxDEV)(\'div\',{className:\'text-xs text-gray-600 space-y-1 pt-1\',children:[(0,I.jsxDEV)(\'p\',{children:\'• Handcrafted in Roorkee, District Haridwar atelier with certified purity\'},void 0,!1,{fileName:NN,lineNumber:602,columnNumber:19},void 0),(0,I.jsxDEV)(\'p\',{children:\'• Packed in signature velvet presentation jewellery box\'},void 0,!1,{fileName:NN,lineNumber:603,columnNumber:19},void 0),(0,I.jsxDEV)(\'p\',{children:\'• 7-Day easy returns & instant UPI payment support\'},void 0,!1,{fileName:NN,lineNumber:604,columnNumber:19},void 0)]},void 0,!0,{fileName:NN,lineNumber:601,columnNumber:17},void 0)
                  ]
                },void 0,!0,{fileName:NN,lineNumber:560,columnNumber:15},void 0),
                (0,I.jsxDEV)(\'div\',{
                  className:\'space-y-2.5 pt-4 border-t border-[#E8DCCF]\',
                  children:[
                    (0,I.jsxDEV)(\'button\',{onClick:()=>handleSelectProduct(activeModalReel),className:\'w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2\',children:[(0,I.jsxDEV)(\'span\',{children:\'SHOP NOW\'},void 0,!1,{fileName:NN,lineNumber:614,columnNumber:19},void 0),(0,I.jsxDEV)(BD,{className:\'w-4 h-4 text-white\'},void 0,!1,{fileName:NN,lineNumber:615,columnNumber:19},void 0)]},void 0,!0,{fileName:NN,lineNumber:610,columnNumber:17},void 0),
                    (0,I.jsxDEV)(\'button\',{onClick:()=>handleQuickAdd(activeModalReel),className:\'w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2\',children:addedId===activeModalReel.id?(0,I.jsxDEV)(I.Fragment,{children:[(0,I.jsxDEV)(GD,{className:\'w-4 h-4 text-white\'},void 0,!1,{fileName:NN,lineNumber:624,columnNumber:23},void 0),(0,I.jsxDEV)(\'span\',{children:\'ADDED TO BAG!\'},void 0,!1,{fileName:NN,lineNumber:625,columnNumber:23},void 0)]},void 0,!0,{fileName:NN,lineNumber:623,columnNumber:21},void 0):(0,I.jsxDEV)(I.Fragment,{children:[(0,I.jsxDEV)(nk,{className:\'w-4 h-4 text-white\'},void 0,!1,{fileName:NN,lineNumber:629,columnNumber:23},void 0),(0,I.jsxDEV)(\'span\',{children:\'ADD TO SHOPPING BAG\'},void 0,!1,{fileName:NN,lineNumber:630,columnNumber:23},void 0)]},void 0,!0,{fileName:NN,lineNumber:628,columnNumber:21},void 0)},void 0,!1,{fileName:NN,lineNumber:618,columnNumber:17},void 0)
                  ]
                },void 0,!0,{fileName:NN,lineNumber:609,columnNumber:15},void 0)
              ]
            },void 0,!0,{fileName:NN,lineNumber:559,columnNumber:13},void 0)
          ]
        },void 0,!0,{fileName:NN,lineNumber:466,columnNumber:11},void 0)
      },void 0,!1,{fileName:NN,lineNumber:461,columnNumber:9},void 0)
    ]
  },void 0,!0,{fileName:NN,lineNumber:290,columnNumber:5},void 0);
}`;

replaceExact('ShopByVideoSection PN & FN', oldShopByVid, newShopByVid);

// ============================================================================
// 5. Fix App.tsx (bF) - Safe cache initialization & media-preserving state updates
// ============================================================================
const oldAppState = `[S,ie]=(0,x.useState)(()=>{let e=kE();return e.length>0?e:[]}),[ae,oe]=(0,x.useState)(()=>{let e=YE();return e.length>0?e:gE}),[se,ce]=(0,x.useState)(vE),[le,ue]=(0,x.useState)(()=>kE().length===0)`;
const newAppState = `[S,ie]=(0,x.useState)(()=>{let e=kE();return e.length>0&&!e.some(p=>p&&p._strippedImg&&(!p.images||p.images.length===0))?e:[]}),[ae,oe]=(0,x.useState)(()=>{let e=YE();return e.length>0?e:gE}),[se,ce]=(0,x.useState)(vE),[le,ue]=(0,x.useState)(()=>{let e=kE();return e.length===0||e.some(p=>p&&p._strippedImg&&(!p.images||p.images.length===0))})`;
replaceExact('App.tsx initial products state', oldAppState, newAppState);

const oldAppEffects = `let e=GE(e=>{Array.isArray(e)&&e.length>0&&ie(e)},e=>{console.warn(\`[Storefront] Firestore real-time notice:\`,e?.message||e)}),t=e=>{e.detail&&Array.isArray(e.detail)&&e.detail.length>0&&ie(e.detail)};`;
const newAppEffects = `let safeSet=next=>ie(prev=>{
  if(!Array.isArray(next)||next.length===0)return prev;
  let pm=new Map(prev.filter(x=>x&&x.id).map(x=>[x.id,x]));
  return next.map(p=>p&&p.id?__mergeProductMedia(p,pm.get(p.id)):p);
});
let e=GE(list=>{Array.isArray(list)&&list.length>0&&safeSet(list)},err=>{console.warn(\`[Storefront] Firestore real-time notice:\`,err?.message||err)}),
    t=ev=>{ev.detail&&Array.isArray(ev.detail)&&ev.detail.length>0&&safeSet(ev.detail)};`;
replaceExact('App.tsx real-time product merge guard', oldAppEffects, newAppEffects);

// Syntax validation BEFORE writing
console.log('Running vm.Script syntax validation...');
new vm.Script(bundle);
console.log('Syntax validation PASSED!');

fs.writeFileSync(bundlePath, bundle, 'utf8');
console.log('Saved updated bundle to', bundlePath, 'size:', bundle.length);
