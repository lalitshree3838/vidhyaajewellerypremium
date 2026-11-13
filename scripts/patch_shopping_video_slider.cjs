const fs = require('fs');

const bundlePath = 'assets/index-D2RoHgHG.js';
let bundle = fs.readFileSync(bundlePath, 'utf8');

// Locate start of PN and end of FN
const pStart = bundle.indexOf('PN=({videoUrl:e');
if (pStart === -1) {
  console.error('Could not find PN=({videoUrl:e');
  process.exit(1);
}

const fnMarker = ',H=`/app/applet/src/views/HomeView.tsx`';
const fnEnd = bundle.indexOf(fnMarker);
if (fnEnd === -1) {
  console.error('Could not find fnMarker');
  process.exit(1);
}

console.log('Found PN at', pStart, 'and FN ends at', fnEnd);

// Replacement code for PN and FN
const replacement = `PN=({videoUrl:e,fallbackImage:t,title:n,isMuted:r=!0,isActive:i=!0})=>{
  let v=(0,x.useRef)(null),
      [hasErr,setHasErr]=(0,x.useState)(!1),
      [playing,setPlaying]=(0,x.useState)(!1);

  let playVid=(0,x.useCallback)(()=>{
    let el=v.current;
    if(!el)return;
    el.muted=r;
    el.defaultMuted=r;
    el.playsInline=!0;
    if(i){
      let p=el.play();
      p!==void 0&&p.then(()=>setPlaying(!0)).catch(()=>{
        el.muted=!0;
        el.defaultMuted=!0;
        el.setAttribute('muted','');
        el.play().then(()=>setPlaying(!0)).catch(()=>{});
      });
    }else{
      el.pause();
      setPlaying(!1);
    }
  },[r,i]);

  let setRef=(0,x.useCallback)(el=>{
    v.current=el;
    if(el){
      el.muted=r;
      el.defaultMuted=r;
      el.playsInline=!0;
      el.setAttribute('playsinline','');
      el.setAttribute('webkit-playsinline','true');
      r?el.setAttribute('muted',''):el.removeAttribute('muted');
      if(i){
        let p=el.play();
        p!==void 0&&p.then(()=>setPlaying(!0)).catch(()=>{
          el.muted=!0;
          el.defaultMuted=!0;
          el.setAttribute('muted','');
          el.play().then(()=>setPlaying(!0)).catch(()=>{});
        });
      }
    }
  },[r,i]);

  (0,x.useEffect)(()=>{
    let el=v.current;
    if(!el)return;
    el.muted=r;
    el.defaultMuted=r;
    r?el.setAttribute('muted',''):el.removeAttribute('muted');
  },[r]);

  (0,x.useEffect)(()=>{
    let el=v.current;
    if(!el)return;
    if(i){
      let p=el.play();
      p!==void 0&&p.then(()=>setPlaying(!0)).catch(()=>{
        el.muted=!0;
        el.setAttribute('muted','');
        el.play().then(()=>setPlaying(!0)).catch(()=>{});
      });
    }else{
      el.pause();
      setPlaying(!1);
    }
  },[i]);

  (0,x.useEffect)(()=>{
    if(!i)return;
    let onUser=()=>{
      let el=v.current;
      if(el&&el.paused){
        let p=el.play();
        p!==void 0&&p.then(()=>setPlaying(!0)).catch(()=>{});
      }
    };
    let evts=['touchstart','click','scroll'];
    evts.forEach(evt=>window.addEventListener(evt,onUser,{passive:!0,once:!0}));
    return ()=>evts.forEach(evt=>window.removeEventListener(evt,onUser));
  },[i]);

  return (0,I.jsxDEV)('div',{
    className:'absolute inset-0 w-full h-full overflow-hidden bg-black select-none',
    children:[
      (0,I.jsxDEV)('video',{
        ref:setRef,
        src:e,
        autoPlay:i,
        muted:r,
        loop:!0,
        playsInline:!0,
        'webkit-playsinline':'true',
        preload:'auto',
        title:n,
        onCanPlay:()=>{if(i)playVid();},
        onLoadedData:()=>{if(i)playVid();},
        onPlay:()=>setPlaying(!0),
        onPause:()=>setPlaying(!1),
        onError:()=>{setHasErr(!0);},
        className:'w-full h-full object-cover select-none block relative z-0',
        style:{width:'100%',height:'100%',objectFit:'cover'},
        'aria-hidden':'true',
        tabIndex:-1,
        children:(0,I.jsxDEV)('source',{src:e,type:'video/mp4'},void 0,!1,{fileName:NN,lineNumber:61,columnNumber:9},void 0)
      },void 0,!1,{fileName:NN,lineNumber:60,columnNumber:7},void 0),
      t&&hasErr&&(0,I.jsxDEV)('img',{
        src:t,
        alt:n||'VIDHYAA Jewellery',
        className:'absolute inset-0 w-full h-full object-cover pointer-events-none z-10',
        loading:'eager'
      },void 0,!1,{fileName:NN,lineNumber:58,columnNumber:9},void 0)
    ]
  },void 0,!0,{fileName:NN,lineNumber:59,columnNumber:5},void 0);
};

var FN=({products:e,onSelectProduct:t})=>{
  let{addToCart:n,openCart:r}=TD(),
      trackRef=(0,x.useRef)(null),
      reels=(0,x.useMemo)(()=>{
        let list=e.filter(e=>!!(e.videoUrl&&mE(e.videoUrl)&&!fE.has(e.id)&&e.showInShoppingVideos!==!1)).map(e=>{
          let thumb=(e.images||[]).find(pE)||'';
          return{
            id:\`reel-\${e.id}\`,
            title:e.name,
            category:e.categoryName||'Fine Jewellery',
            price:e.price,
            mrp:e.mrp,
            discount:e.discountPercent,
            videoUrl:e.videoUrl,
            posterImage:thumb,
            duration:'0:15',
            features:e.shortDescription||e.description?.slice(0,70)||\`₹\${e.price.toLocaleString('en-IN')}\`,
            productId:e.id,
            rawProduct:e
          };
        });
        let seen=new Set(list.map(e=>e.productId));
        let fallback=_E.filter(e=>!!(e.videoUrl&&mE(e.videoUrl)&&!seen.has(e.id)&&e.showInShoppingVideos!==!1)).map(e=>{
          let thumb=(e.images||[]).find(pE)||'';
          return{
            id:\`reel-\${e.id}\`,
            title:e.name,
            category:e.categoryName||'Fine Jewellery',
            price:e.price,
            mrp:e.mrp,
            discount:e.discountPercent,
            videoUrl:e.videoUrl,
            posterImage:thumb,
            duration:'0:15',
            features:e.shortDescription||e.description?.slice(0,70)||\`₹\${e.price.toLocaleString('en-IN')}\`,
            productId:e.id,
            rawProduct:e
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
    if(reel.productId){
      let found=e.find(p=>p.id===reel.productId);
      if(found)return found;
    }
    let bareId=reel.id.replace(/^reel-/,'');
    return e.find(p=>p.id===bareId)||e[0];
  };

  let handleSelectProduct=(reel)=>{
    let prod=getProduct(reel);
    setModalIdx(null);
    t(prod);
  };

  let handleQuickAdd=(reel)=>{
    let prod=getProduct(reel);
    let variation=prod.variations?.[0]||{
      id:\`\${prod.id}-var-1\`,
      name:'Standard Finish',
      colorFinish:'Gold',
      hexCode:'#D4AF37',
      sku:\`VDH-\${prod.id}\`,
      price:prod.price,
      mrp:prod.mrp,
      stock:10,
      image:reel.posterImage,
      active:!0
    };
    n(prod,variation,1);
    setAddedId(reel.id);
    MN({particleCount:50,spread:60,origin:{y:.6}});
    setTimeout(()=>setAddedId(null),2500);
    r();
  };

  let scrollToSlide=(idx)=>{
    let clamped=(idx+reels.length)%reels.length;
    setActiveSlide(clamped);
    let track=trackRef.current;
    if(track&&track.children&&track.children[clamped]){
      track.children[clamped].scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
    }
  };

  let scrollDir=(dir)=>{
    let nextIdx=dir==='left'?(activeSlide-1+reels.length)%reels.length:(activeSlide+1)%reels.length;
    scrollToSlide(nextIdx);
  };

  let onTrackScroll=(0,x.useCallback)(()=>{
    let el=trackRef.current;
    if(!el||!el.children||el.children.length===0)return;
    let trackRect=el.getBoundingClientRect();
    let trackCenter=trackRect.left+trackRect.width/2;
    let closestIdx=0;
    let closestDist=Infinity;
    for(let k=0;k<el.children.length;k++){
      let child=el.children[k];
      let r=child.getBoundingClientRect();
      let center=r.left+r.width/2;
      let dist=Math.abs(trackCenter-center);
      if(dist<closestDist){
        closestDist=dist;
        closestIdx=k;
      }
    }
    if(closestIdx!==activeSlide){
      setActiveSlide(closestIdx);
    }
  },[activeSlide]);

  (0,x.useEffect)(()=>{
    let onKey=(evt)=>{
      if(modalIdx!==null&&reels.length!==0){
        if(evt.key==='Escape')setModalIdx(null);
        if(evt.key==='ArrowRight')setModalIdx((modalIdx+1)%reels.length);
        if(evt.key==='ArrowLeft')setModalIdx((modalIdx-1+reels.length)%reels.length);
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[modalIdx,reels.length]);

  if(reels.length===0){
    return (0,I.jsxDEV)('section',{
      id:'shopping-video',
      className:'relative overflow-hidden py-14 bg-[#FAF7F2] border-y border-[#E8DCCF]',
      children:(0,I.jsxDEV)('div',{
        className:'max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4',
        children:[
          (0,I.jsxDEV)('div',{
            className:'inline-flex items-center gap-2 bg-[#E8DCCF]/60 text-[#802336] text-[11px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-[#DFB982]/40',
            children:[
              (0,I.jsxDEV)(ak,{className:'w-3.5 h-3.5 text-[#B8860B]'},void 0,!1,{fileName:NN,lineNumber:262,columnNumber:13},void 0),
              (0,I.jsxDEV)('span',{children:'Studio Video Demonstrations'},void 0,!1,{fileName:NN,lineNumber:263,columnNumber:13},void 0)
            ]
          },void 0,!0,{fileName:NN,lineNumber:261,columnNumber:11},void 0),
          (0,I.jsxDEV)('h2',{className:'font-serif text-2xl sm:text-3xl font-bold text-[#241C1A]',children:'Craftsmanship in Motion'},void 0,!1,{fileName:NN,lineNumber:265,columnNumber:11},void 0),
          (0,I.jsxDEV)('p',{className:'text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed',children:'High-definition 360° video showcases and reel demonstrations will appear here once videos are uploaded.'},void 0,!1,{fileName:NN,lineNumber:268,columnNumber:11},void 0)
        ]
      },void 0,!0,{fileName:NN,lineNumber:260,columnNumber:9},void 0)
    },void 0,!1,{fileName:NN,lineNumber:259,columnNumber:7},void 0);
  }

  let activeModalReel=modalIdx===null?null:reels[modalIdx];

  return (0,I.jsxDEV)('section',{
    id:'shopping-video',
    className:'relative overflow-hidden py-16 sm:py-20 bg-[#FAF7F2] border-y border-[#E8DCCF]',
    children:[
      (0,I.jsxDEV)('div',{className:'absolute inset-0 bg-radial from-white/80 via-[#FAF7F2]/95 to-[#FAF7F2] pointer-events-none'},void 0,!1,{fileName:NN,lineNumber:292,columnNumber:7},void 0),
      (0,I.jsxDEV)('div',{className:'absolute top-0 right-1/4 w-96 h-96 bg-[#DFB982]/10 rounded-full blur-3xl pointer-events-none'},void 0,!1,{fileName:NN,lineNumber:293,columnNumber:7},void 0),
      (0,I.jsxDEV)('div',{className:'absolute bottom-0 left-1/4 w-96 h-96 bg-[#FAF7F2] rounded-full blur-3xl pointer-events-none'},void 0,!1,{fileName:NN,lineNumber:294,columnNumber:7},void 0),
      (0,I.jsxDEV)('div',{
        className:'relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8',
        children:[
          (0,I.jsxDEV)('div',{
            className:'flex flex-col md:flex-row md:items-end justify-between gap-6 text-center md:text-left',
            children:[
              (0,I.jsxDEV)('div',{
                className:'space-y-2 max-w-2xl mx-auto md:mx-0',
                children:[
                  (0,I.jsxDEV)('div',{
                    className:'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DFB982]/20 border border-[#DFB982]/40 text-[#802336] text-[11px] font-bold uppercase tracking-widest',
                    children:[
                      (0,I.jsxDEV)(ak,{className:'w-3 h-3 text-[#B8860B]'},void 0,!1,{fileName:NN,lineNumber:301,columnNumber:15},void 0),
                      (0,I.jsxDEV)('span',{children:'Discover Our Jewellery in Motion'},void 0,!1,{fileName:NN,lineNumber:302,columnNumber:15},void 0)
                    ]
                  },void 0,!0,{fileName:NN,lineNumber:300,columnNumber:13},void 0),
                  (0,I.jsxDEV)('h2',{className:'font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#241C1A] tracking-tight',children:'SHOPPING VIDEO'},void 0,!1,{fileName:NN,lineNumber:305,columnNumber:13},void 0),
                  (0,I.jsxDEV)('p',{className:'text-xs sm:text-sm text-[#5C4D4A] leading-relaxed font-normal',children:'Experience the unmatched brilliance, movement, and intricate hand-carved detailing of our regal Indian jewellery in dynamic portrait reels.'},void 0,!1,{fileName:NN,lineNumber:309,columnNumber:13},void 0)
                ]
              },void 0,!0,{fileName:NN,lineNumber:299,columnNumber:11},void 0),
              (0,I.jsxDEV)('div',{
                className:'hidden sm:flex items-center justify-center gap-2.5',
                children:[
                  (0,I.jsxDEV)('button',{
                    onClick:()=>scrollDir('left'),
                    className:'w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer',
                    title:'Previous video',
                    'aria-label':'Previous video',
                    children:(0,I.jsxDEV)(qD,{className:'w-5 h-5'},void 0,!1,{fileName:NN,lineNumber:322,columnNumber:15},void 0)
                  },void 0,!1,{fileName:NN,lineNumber:316,columnNumber:13},void 0),
                  (0,I.jsxDEV)('button',{
                    onClick:()=>scrollDir('right'),
                    className:'w-11 h-11 rounded-full bg-white hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] hover:border-[#D4AF37] shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer',
                    title:'Next video',
                    'aria-label':'Next video',
                    children:(0,I.jsxDEV)(JD,{className:'w-5 h-5'},void 0,!1,{fileName:NN,lineNumber:331,columnNumber:15},void 0)
                  },void 0,!1,{fileName:NN,lineNumber:325,columnNumber:13},void 0)
                ]
              },void 0,!0,{fileName:NN,lineNumber:315,columnNumber:11},void 0)
            ]
          },void 0,!0,{fileName:NN,lineNumber:298,columnNumber:9},void 0),
          (0,I.jsxDEV)('div',{
            ref:trackRef,
            onScroll:onTrackScroll,
            className:'flex gap-5 sm:gap-6 overflow-x-auto pb-4 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0',
            children:reels.map((reel,idx)=>{
              let isCurrent=idx===activeSlide;
              let isSoundOn=mutedId===reel.id;
              return (0,I.jsxDEV)('div',{
                key:reel.id,
                onClick:()=>{
                  if(activeSlide!==idx){
                    scrollToSlide(idx);
                  }
                },
                className:\`group relative flex-none w-[76vw] xs:w-[68vw] sm:w-[290px] lg:w-[310px] aspect-[9/16] snap-center rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 \${
                  isCurrent?'ring-2 ring-[#DFB982] shadow-2xl scale-[1.01]':'ring-1 ring-[#E8DCCF]/80 shadow-md opacity-90 hover:opacity-100 hover:ring-[#DFB982]/60'
                }\`,
                children:[
                  (0,I.jsxDEV)(PN,{
                    videoUrl:reel.videoUrl,
                    fallbackImage:reel.posterImage,
                    title:reel.title,
                    isMuted:!isSoundOn,
                    isActive:isCurrent
                  },void 0,!1,{fileName:NN,lineNumber:350,columnNumber:17},void 0),
                  (0,I.jsxDEV)('div',{
                    className:'absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35 pointer-events-none z-10'
                  },void 0,!1,{fileName:NN,lineNumber:358,columnNumber:17},void 0),
                  (0,I.jsxDEV)('div',{
                    className:'absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-20',
                    children:[
                      (0,I.jsxDEV)('div',{
                        className:'flex items-center gap-1.5 pointer-events-none',
                        children:[
                          (0,I.jsxDEV)('span',{
                            className:'bg-white/90 backdrop-blur-md text-[#802336] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs border border-[#E8DCCF]',
                            children:reel.category
                          },void 0,!1,{fileName:NN,lineNumber:363,columnNumber:21},void 0),
                          (0,I.jsxDEV)('span',{
                            className:'bg-black/50 backdrop-blur-md text-white text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20',
                            children:[
                              (0,I.jsxDEV)('span',{className:'w-1.5 h-1.5 rounded-full bg-red-500 animate-ping'},void 0,!1,{fileName:NN,lineNumber:368,columnNumber:23},void 0),
                              (0,I.jsxDEV)('span',{children:reel.duration},void 0,!1,{fileName:NN,lineNumber:369,columnNumber:23},void 0)
                            ]
                          },void 0,!0,{fileName:NN,lineNumber:367,columnNumber:21},void 0)
                        ]
                      },void 0,!0,{fileName:NN,lineNumber:362,columnNumber:19},void 0),
                      (0,I.jsxDEV)('button',{
                        type:'button',
                        onClick:(evt)=>{
                          evt.stopPropagation();
                          setMutedId(mutedId===reel.id?null:reel.id);
                        },
                        className:'w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/25 shadow-md active:scale-90',
                        title:isSoundOn?'Click to Mute':'Click to Unmute Sound',
                        'aria-label':isSoundOn?'Mute video sound':'Unmute video sound',
                        children:isSoundOn
                          ?(0,I.jsxDEV)(bk,{className:'w-4 h-4 text-emerald-400'},void 0,!1,{fileName:NN,lineNumber:385,columnNumber:23},void 0)
                          :(0,I.jsxDEV)(xk,{className:'w-4 h-4 text-white/90'},void 0,!1,{fileName:NN,lineNumber:387,columnNumber:23},void 0)
                      },void 0,!1,{fileName:NN,lineNumber:374,columnNumber:19},void 0)
                    ]
                  },void 0,!0,{fileName:NN,lineNumber:361,columnNumber:17},void 0),
                  (0,I.jsxDEV)('div',{
                    onClick:(evt)=>{
                      evt.stopPropagation();
                      handleSelectProduct(reel);
                    },
                    className:'absolute bottom-3 inset-x-3 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-[#DFB982]/50 z-20 flex items-center gap-2.5 transition-all duration-300 hover:bg-white',
                    children:[
                      reel.posterImage&&(0,I.jsxDEV)('img',{
                        src:reel.posterImage,
                        alt:reel.title,
                        className:'w-12 h-12 rounded-xl object-cover border border-[#E8DCCF] flex-shrink-0 bg-white',
                        loading:'lazy'
                      },void 0,!1,{fileName:NN,lineNumber:395,columnNumber:21},void 0),
                      (0,I.jsxDEV)('div',{
                        className:'flex-1 min-w-0 pr-1',
                        children:[
                          (0,I.jsxDEV)('h4',{
                            className:'font-serif text-xs sm:text-sm font-bold text-[#241C1A] truncate leading-tight group-hover:text-[#802336] transition-colors',
                            children:reel.title
                          },void 0,!1,{fileName:NN,lineNumber:400,columnNumber:23},void 0),
                          (0,I.jsxDEV)('div',{
                            className:'flex items-baseline gap-1.5 pt-0.5 flex-wrap',
                            children:[
                              (0,I.jsxDEV)('span',{
                                className:'text-xs sm:text-sm font-bold text-[#802336]',
                                children:Nk(reel.price)
                              },void 0,!1,{fileName:NN,lineNumber:405,columnNumber:25},void 0),
                              reel.mrp>reel.price&&(0,I.jsxDEV)(I.Fragment,{
                                children:[
                                  (0,I.jsxDEV)('span',{
                                    className:'text-[10px] text-gray-400 line-through',
                                    children:Nk(reel.mrp)
                                  },void 0,!1,{fileName:NN,lineNumber:410,columnNumber:29},void 0),
                                  (0,I.jsxDEV)('span',{
                                    className:'text-[9px] bg-[#802336] text-white px-1 py-0.2 rounded font-bold',
                                    children:[Pk(reel.mrp,reel.price),'% OFF']
                                  },void 0,!0,{fileName:NN,lineNumber:415,columnNumber:29},void 0)
                                ]
                              },void 0,!0,{fileName:NN,lineNumber:409,columnNumber:25},void 0)
                            ]
                          },void 0,!0,{fileName:NN,lineNumber:404,columnNumber:23},void 0)
                        ]
                      },void 0,!0,{fileName:NN,lineNumber:399,columnNumber:21},void 0),
                      (0,I.jsxDEV)('button',{
                        type:'button',
                        onClick:(evt)=>{
                          evt.stopPropagation();
                          handleSelectProduct(reel);
                        },
                        className:'btn-teak-green py-2 px-2.5 sm:px-3 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-xs hover:shadow flex-shrink-0',
                        children:[
                          (0,I.jsxDEV)('span',{children:'SHOP NOW'},void 0,!1,{fileName:NN,lineNumber:425,columnNumber:25},void 0),
                          (0,I.jsxDEV)(BD,{className:'w-3 h-3 text-white'},void 0,!1,{fileName:NN,lineNumber:426,columnNumber:25},void 0)
                        ]
                      },void 0,!0,{fileName:NN,lineNumber:424,columnNumber:21},void 0)
                    ]
                  },void 0,!0,{fileName:NN,lineNumber:393,columnNumber:19},void 0)
                ]
              },reel.id,!0,{fileName:NN,lineNumber:342,columnNumber:13},void 0);
            })
          },void 0,!1,{fileName:NN,lineNumber:337,columnNumber:9},void 0),
          reels.length>1&&(0,I.jsxDEV)('div',{
            className:'flex items-center justify-center gap-2 pt-2',
            children:reels.map((reel,dotIdx)=>(0,I.jsxDEV)('button',{
              key:\`dot-\${reel.id}\`,
              type:'button',
              onClick:()=>scrollToSlide(dotIdx),
              className:\`transition-all duration-300 cursor-pointer rounded-full \${
                dotIdx===activeSlide?'w-7 h-2 bg-[#802336]':'w-2 h-2 bg-[#E8DCCF] hover:bg-[#DFB982]'
              }\`,
              title:\`Go to slide \${dotIdx+1}\`,
              'aria-label':\`Go to slide \${dotIdx+1}\`
            },void 0,!1,{fileName:NN,lineNumber:440,columnNumber:15},void 0))
          },void 0,!1,{fileName:NN,lineNumber:438,columnNumber:9},void 0),
          (0,I.jsxDEV)('div',{
            className:'sm:hidden text-center text-[11px] text-[#802336] font-semibold flex items-center justify-center gap-1.5',
            children:(0,I.jsxDEV)('span',{children:'← Swipe to explore more jewellery reels →'},void 0,!1,{fileName:NN,lineNumber:453,columnNumber:11},void 0)
          },void 0,!1,{fileName:NN,lineNumber:452,columnNumber:9},void 0)
        ]
      },void 0,!0,{fileName:NN,lineNumber:296,columnNumber:7},void 0),
      activeModalReel&&(0,I.jsxDEV)('div',{
        className:'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn',
        onClick:()=>setModalIdx(null),
        children:(0,I.jsxDEV)('div',{
          className:'relative w-full max-w-4xl bg-[#FAF7F2] rounded-3xl overflow-hidden shadow-2xl border border-[#DFB982]/50 flex flex-col md:flex-row max-h-[92vh]',
          onClick:evt=>evt.stopPropagation(),
          children:[
            (0,I.jsxDEV)('button',{
              onClick:()=>setModalIdx(null),
              className:'absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer',
              title:'Close video viewer (Esc)',
              'aria-label':'Close video viewer',
              children:(0,I.jsxDEV)(Sk,{className:'w-5 h-5'},void 0,!1,{fileName:NN,lineNumber:477,columnNumber:15},void 0)
            },void 0,!1,{fileName:NN,lineNumber:471,columnNumber:13},void 0),
            (0,I.jsxDEV)('div',{
              className:'relative md:w-3/5 bg-black flex items-center justify-center overflow-hidden select-none',
              children:[
                (0,I.jsxDEV)('div',{
                  className:'relative w-full h-full max-h-[550px] md:max-h-[640px] flex items-center justify-center cursor-pointer',
                  onClick:()=>{
                    let vEl=modalVideoRef.current;
                    if(vEl){
                      if(modalPlaying){vEl.pause();setModalPlaying(!1);}
                      else{vEl.play().catch(()=>{});setModalPlaying(!0);}
                    }
                  },
                  children:[
                    (0,I.jsxDEV)(Lk,{
                      ref:modalVideoRef,
                      src:activeModalReel.videoUrl,
                      poster:void 0,
                      fallbackImage:activeModalReel.posterImage,
                      title:activeModalReel.title,
                      autoPlay:!0,
                      isMuted:modalMuted,
                      enableObserver:!1,
                      showPlayButtonFallback:!0,
                      className:'w-full h-full max-h-[550px] md:max-h-[640px] object-contain select-none',
                      style:{width:'100%',height:'100%',objectFit:'contain'}
                    },activeModalReel.id,!1,{fileName:NN,lineNumber:486,columnNumber:17},void 0),
                    !modalPlaying&&(0,I.jsxDEV)('div',{
                      className:'absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none',
                      children:(0,I.jsxDEV)('div',{
                        className:'w-16 h-16 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/20 text-[#DFB982]',
                        children:(0,I.jsxDEV)(VO,{className:'w-8 h-8 fill-[#DFB982] ml-1'},void 0,!1,{fileName:NN,lineNumber:504,columnNumber:23},void 0)
                      },void 0,!1,{fileName:NN,lineNumber:503,columnNumber:21},void 0)
                    },void 0,!1,{fileName:NN,lineNumber:502,columnNumber:19},void 0),
                    (0,I.jsxDEV)('button',{
                      onClick:evt=>{
                        evt.stopPropagation();
                        if(modalVideoRef.current){
                          let isM=modalVideoRef.current.toggleMute();
                          setModalMuted(isM);
                        }else setModalMuted(!modalMuted);
                      },
                      className:'absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20',
                      title:modalMuted?'Click to Unmute':'Click to Mute',
                      children:modalMuted
                        ?(0,I.jsxDEV)(xk,{className:'w-4 h-4 text-red-300'},void 0,!1,{fileName:NN,lineNumber:520,columnNumber:21},void 0)
                        :(0,I.jsxDEV)(bk,{className:'w-4 h-4 text-emerald-400'},void 0,!1,{fileName:NN,lineNumber:522,columnNumber:21},void 0)
                    },void 0,!1,{fileName:NN,lineNumber:510,columnNumber:17},void 0)
                  ]
                },void 0,!0,{fileName:NN,lineNumber:482,columnNumber:15},void 0),
                (0,I.jsxDEV)('div',{
                  className:'absolute bottom-4 left-4 z-20 pointer-events-none',
                  children:(0,I.jsxDEV)('div',{
                    className:'bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono border border-white/20 text-[#DFB982]',
                    children:[modalIdx+1,' / ',reels.length]
                  },void 0,!0,{fileName:NN,lineNumber:529,columnNumber:17},void 0)
                },void 0,!1,{fileName:NN,lineNumber:528,columnNumber:15},void 0),
                (0,I.jsxDEV)('button',{
                  onClick:evt=>{evt.stopPropagation();setModalIdx((modalIdx-1+reels.length)%reels.length);},
                  className:'absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20',
                  title:'Previous jewellery reel',
                  children:(0,I.jsxDEV)(qD,{className:'w-5 h-5'},void 0,!1,{fileName:NN,lineNumber:543,columnNumber:17},void 0)
                },void 0,!1,{fileName:NN,lineNumber:535,columnNumber:15},void 0),
                (0,I.jsxDEV)('button',{
                  onClick:evt=>{evt.stopPropagation();setModalIdx((modalIdx+1)%reels.length);},
                  className:'absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer z-20 border border-white/20',
                  title:'Next jewellery reel',
                  children:(0,I.jsxDEV)(JD,{className:'w-5 h-5'},void 0,!1,{fileName:NN,lineNumber:554,columnNumber:17},void 0)
                },void 0,!1,{fileName:NN,lineNumber:546,columnNumber:15},void 0)
              ]
            },void 0,!0,{fileName:NN,lineNumber:481,columnNumber:13},void 0),
            (0,I.jsxDEV)('div',{
              className:'md:w-2/5 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-white overflow-y-auto',
              children:[
                (0,I.jsxDEV)('div',{
                  className:'space-y-4',
                  children:[
                    (0,I.jsxDEV)('div',{
                      className:'flex items-center gap-2',
                      children:[
                        (0,I.jsxDEV)('span',{
                          className:'bg-[#DFB982]/20 text-[#802336] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider',
                          children:activeModalReel.category
                        },void 0,!1,{fileName:NN,lineNumber:562,columnNumber:19},void 0),
                        (0,I.jsxDEV)('div',{
                          className:'flex items-center gap-1 text-[#B8860B] text-xs font-semibold',
                          children:[
                            (0,I.jsxDEV)(sk,{className:'w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]'},void 0,!1,{fileName:NN,lineNumber:566,columnNumber:21},void 0),
                            (0,I.jsxDEV)('span',{children:'4.9 / 5.0 Rating'},void 0,!1,{fileName:NN,lineNumber:567,columnNumber:21},void 0)
                          ]
                        },void 0,!0,{fileName:NN,lineNumber:565,columnNumber:19},void 0)
                      ]
                    },void 0,!0,{fileName:NN,lineNumber:561,columnNumber:17},void 0),
                    (0,I.jsxDEV)('div',{
                      children:[
                        (0,I.jsxDEV)('h3',{className:'font-serif text-xl sm:text-2xl font-bold text-[#241C1A]',children:activeModalReel.title},void 0,!1,{fileName:NN,lineNumber:572,columnNumber:19},void 0),
                        (0,I.jsxDEV)('p',{className:'text-xs text-[#5C4D4A] mt-1.5 leading-relaxed',children:activeModalReel.features},void 0,!1,{fileName:NN,lineNumber:575,columnNumber:19},void 0)
                      ]
                    },void 0,!0,{fileName:NN,lineNumber:571,columnNumber:17},void 0),
                    (0,I.jsxDEV)('div',{
                      className:'p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E8DCCF] space-y-1',
                      children:[
                        (0,I.jsxDEV)('div',{
                          className:'flex items-baseline gap-2 flex-wrap',
                          children:[
                            (0,I.jsxDEV)('span',{className:'text-2xl font-serif font-bold text-[#802336]',children:Nk(activeModalReel.price)},void 0,!1,{fileName:NN,lineNumber:582,columnNumber:21},void 0),
                            activeModalReel.mrp>activeModalReel.price&&(0,I.jsxDEV)(I.Fragment,{
                              children:[
                                (0,I.jsxDEV)('span',{className:'text-sm text-gray-400 line-through',children:Nk(activeModalReel.mrp)},void 0,!1,{fileName:NN,lineNumber:587,columnNumber:25},void 0),
                                (0,I.jsxDEV)('span',{className:'text-xs bg-[#D4AF37] text-[#3B1E22] font-bold px-2 py-0.5 rounded shadow-xs uppercase tracking-wider',children:[Pk(activeModalReel.mrp,activeModalReel.price),'% OFF']},void 0,!0,{fileName:NN,lineNumber:590,columnNumber:25},void 0)
                              ]
                            },void 0,!0,{fileName:NN,lineNumber:586,columnNumber:23},void 0)
                          ]
                        },void 0,!0,{fileName:NN,lineNumber:581,columnNumber:19},void 0),
                        (0,I.jsxDEV)('span',{className:'text-[11px] text-emerald-700 font-medium block',children:'✓ In Stock • Insured Express Dispatch from Atelier'},void 0,!1,{fileName:NN,lineNumber:596,columnNumber:19},void 0)
                      ]
                    },void 0,!0,{fileName:NN,lineNumber:580,columnNumber:17},void 0),
                    (0,I.jsxDEV)('div',{
                      className:'text-xs text-gray-600 space-y-1 pt-1',
                      children:[
                        (0,I.jsxDEV)('p',{children:'• Handcrafted in Roorkee, District Haridwar atelier with certified purity'},void 0,!1,{fileName:NN,lineNumber:602,columnNumber:19},void 0),
                        (0,I.jsxDEV)('p',{children:'• Packed in signature velvet presentation jewellery box'},void 0,!1,{fileName:NN,lineNumber:603,columnNumber:19},void 0),
                        (0,I.jsxDEV)('p',{children:'• 7-Day easy returns & instant UPI payment support'},void 0,!1,{fileName:NN,lineNumber:604,columnNumber:19},void 0)
                      ]
                    },void 0,!0,{fileName:NN,lineNumber:601,columnNumber:17},void 0)
                  ]
                },void 0,!0,{fileName:NN,lineNumber:560,columnNumber:15},void 0),
                (0,I.jsxDEV)('div',{
                  className:'space-y-2.5 pt-4 border-t border-[#E8DCCF]',
                  children:[
                    (0,I.jsxDEV)('button',{
                      onClick:()=>handleSelectProduct(activeModalReel),
                      className:'w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2',
                      children:[
                        (0,I.jsxDEV)('span',{children:'SHOP NOW'},void 0,!1,{fileName:NN,lineNumber:614,columnNumber:19},void 0),
                        (0,I.jsxDEV)(BD,{className:'w-4 h-4 text-white'},void 0,!1,{fileName:NN,lineNumber:615,columnNumber:19},void 0)
                      ]
                    },void 0,!0,{fileName:NN,lineNumber:610,columnNumber:17},void 0),
                    (0,I.jsxDEV)('button',{
                      onClick:()=>handleQuickAdd(activeModalReel),
                      className:'w-full btn-teak-green py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2',
                      children:addedId===activeModalReel.id
                        ?(0,I.jsxDEV)(I.Fragment,{
                            children:[
                              (0,I.jsxDEV)(GD,{className:'w-4 h-4 text-white'},void 0,!1,{fileName:NN,lineNumber:624,columnNumber:23},void 0),
                              (0,I.jsxDEV)('span',{children:'ADDED TO BAG!'},void 0,!1,{fileName:NN,lineNumber:625,columnNumber:23},void 0)
                            ]
                          },void 0,!0,{fileName:NN,lineNumber:623,columnNumber:21},void 0)
                        :(0,I.jsxDEV)(I.Fragment,{
                            children:[
                              (0,I.jsxDEV)(nk,{className:'w-4 h-4 text-white'},void 0,!1,{fileName:NN,lineNumber:629,columnNumber:23},void 0),
                              (0,I.jsxDEV)('span',{children:'ADD TO SHOPPING BAG'},void 0,!1,{fileName:NN,lineNumber:630,columnNumber:23},void 0)
                            ]
                          },void 0,!0,{fileName:NN,lineNumber:628,columnNumber:21},void 0)
                    },void 0,!1,{fileName:NN,lineNumber:618,columnNumber:17},void 0)
                  ]
                },void 0,!0,{fileName:NN,lineNumber:609,columnNumber:15},void 0)
              ]
            },void 0,!0,{fileName:NN,lineNumber:559,columnNumber:13},void 0)
          ]
        },void 0,!0,{fileName:NN,lineNumber:466,columnNumber:11},void 0)
      },void 0,!1,{fileName:NN,lineNumber:461,columnNumber:9},void 0)
    ]
  },void 0,!0,{fileName:NN,lineNumber:290,columnNumber:5},void 0);
};`;

const newBundle = bundle.slice(0, pStart) + replacement + bundle.slice(fnEnd);
fs.writeFileSync(bundlePath, newBundle, 'utf8');
console.log('Successfully patched assets/index-D2RoHgHG.js');

if (fs.existsSync('dist/assets/index-D2RoHgHG.js')) {
  fs.writeFileSync('dist/assets/index-D2RoHgHG.js', newBundle, 'utf8');
  console.log('Successfully patched dist/assets/index-D2RoHgHG.js');
}
