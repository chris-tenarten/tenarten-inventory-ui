// Adapted from archived iTenify engine-motion.js and spark-paths.json (2026-10-16).
// Decorative renderer only. No readiness, session, progress or dismissal ownership.
import source from "./welcome-spark-paths.json";
export function createWelcomeSparks(root, mark, front, heat, rear, image) {
 const SCALE=1.4;
 const frontCtx=front.getContext('2d'),heatCtx=heat.getContext('2d'),rearCtx=rear.getContext('2d');
 if(!frontCtx||!heatCtx||!rearCtx)return {render(){},clear(){}};
 const mask=document.createElement('canvas');mask.width=728;mask.height=806;
 mask.getContext('2d').drawImage(image,148,42,728,806,0,0,728,806);
 const field=document.createElement('canvas');field.width=728;field.height=806;const ctx=field.getContext('2d');
 const paths=source.seams.map(s=>({...s,start:s.start*SCALE,duration:s.duration*SCALE}));
 const v=root.getBoundingClientRect(),r=mark.getBoundingClientRect();
 const layout={x:r.left-v.left,y:r.top-v.top,scale:r.width/728,scaleY:r.height/806,dpr:Math.min(2,devicePixelRatio||1)};
 for(const c of [rear,heat]){c.width=728;c.height=806;}
 front.width=Math.round(v.width*layout.dpr);front.height=Math.round(v.height*layout.dpr);
 function clear(){for(const c of[rearCtx,heatCtx])c.clearRect(0,0,728,806);frontCtx.setTransform(1,0,0,1,0,0);frontCtx.clearRect(0,0,front.width,front.height);}
 const particles=[];
 for(let si=0;si<paths.length;si++){const s=paths[si];s.emitters.forEach((p,i)=>{for(let j=0;j<3;j++){
   const seed=(si*29+i*17+j*13)%37/37,angle=(seed*2-1)*1.3;
   particles.push({birth:s.start+s.duration*p.t+j*13,x:p.x,y:p.y,vx:(s.normal[0]*210+Math.sin(angle)*220)*(0.65+seed),vy:-245+seed*220+(j===2?100:0),gravity:540+seed*330,life:(230+seed*200)*SCALE,radius:2.0+seed*2.4,camera:j===0,seed});
 }});}
 const at=(s,t)=>{const q=Math.max(0,Math.min(1,(t-s.start)/s.duration));return{x:s.from[0]+(s.to[0]-s.from[0])*q,y:s.from[1]+(s.to[1]-s.from[1])*q,q};};
 const solid=(s,q)=>s.solidRanges.some(([a,b])=>q>=a&&q<=b);
 function radial(c,x,y,r,stops){const g=c.createRadialGradient(x,y,0,x,y,r);for(const[o,color]of stops)g.addColorStop(o,color);c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
 function render(t){
  clear();ctx.clearRect(0,0,728,806);ctx.globalCompositeOperation='source-over';
  for(const s of paths){if(t<s.start||t>s.start+s.duration+500||t>1630)continue;const p=at(s,t),end=s.start+s.duration;
   // A cool dark kerf (slit), not a luminous outline being traced.
   ctx.strokeStyle='rgba(17,13,11,.8)';ctx.lineWidth=3.8;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(...s.from);ctx.lineTo(p.x,p.y);ctx.stroke();
   // Local molten edge deposits: warm only near the moving penetration, then cool.
   for(let u=0;u<=p.q;u+=.024){const age=t-(s.start+s.duration*u);if(age>100*SCALE)continue;const x=s.from[0]+(s.to[0]-s.from[0])*u,y=s.from[1]+(s.to[1]-s.from[1])*u;const a=Math.max(0,1-age/(100*SCALE));const n=s.normal;
    radial(ctx,x+n[0]*3.5,y+n[1]*3.5,6+4*a,[[0,`rgba(255,126,30,${a*.78})`],[.45,`rgba(170,41,12,${a*.5})`],[1,'rgba(100,22,7,0)']]);
    radial(ctx,x-n[0]*3.5,y-n[1]*3.5,4+3*a,[[0,`rgba(255,167,55,${a*.8})`],[1,'rgba(135,28,9,0)']]);
   }
   ctx.strokeStyle='rgba(14,10,8,.85)';ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(...s.from);ctx.lineTo(p.x,p.y);ctx.stroke();
   if(t<=end&&solid(s,p.q)){
    const flashStart=s.start+s.duration*s.emitters[0].t;const flash=Math.max(0,1-Math.abs(t-flashStart)/90),pulse=1+.12*Math.sin(t*.09)+.08*Math.sin(t*.173);
    // Back-side illumination and foreground cut edges have distinct planes.
    radial(rearCtx,p.x,p.y,32,[[0,'rgba(255,244,173,.9)'],[.35,'rgba(255,144,39,.35)'],[1,'rgba(255,76,15,0)']]);
    radial(ctx,p.x,p.y,23+flash*10,[[0,'rgba(255,235,128,.98)'],[.18,'rgba(255,167,43,.9)'],[.6,'rgba(209,54,12,.38)'],[1,'rgba(175,33,8,0)']]);
    // Thick black lower rim with an offset white/yellow core: a breakthrough, not a torch sprite.
    ctx.fillStyle='#30150a';ctx.beginPath();ctx.ellipse(p.x+2.4,p.y+3.2,6.5,4.7,0,0,Math.PI*2);ctx.fill();
    radial(ctx,p.x,p.y,(5.5+flash*4)*pulse,[[0,'#ffffff'],[.30,'#fffde1'],[.68,'#ffe99b'],[1,'rgba(255,159,33,.15)']]);
   }
  }
  ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';heatCtx.drawImage(field,0,0);
  const d=layout.dpr;frontCtx.setTransform(d,0,0,d,0,0);
  for(const p of particles){const age=t-p.birth;if(age<0||age>p.life)continue;const sec=age/(1000*SCALE),q=age/p.life;const camera=p.camera?1+q*3.2:1;const x=p.x+p.vx*sec*(p.camera?1+q*.6:1),y=p.y+p.vy*sec+.5*p.gravity*sec*sec;const px=layout.x+x*layout.scale,py=layout.y+y*layout.scaleY;const r=Math.max(.65,p.radius*layout.scale*camera);const a=Math.min(1,q*12)*Math.pow(1-q,.65);
   const prior=Math.max(0,sec-.022/SCALE);const tx=layout.x+(p.x+p.vx*prior)*layout.scale,ty=layout.y+(p.y+p.vy*prior+.5*p.gravity*prior*prior)*layout.scaleY;
   frontCtx.globalAlpha=a*.85;frontCtx.strokeStyle=q<.35?'#ffe9a0':'#da6b22';frontCtx.lineWidth=Math.max(.65,r*.72);frontCtx.beginPath();frontCtx.moveTo(tx,ty);frontCtx.lineTo(px,py);frontCtx.stroke();
   radial(frontCtx,px,py,r*3.3,[[0,'rgba(255,242,182,.92)'],[.25,'rgba(255,169,56,.7)'],[1,'rgba(255,80,15,0)']]);frontCtx.globalAlpha=a;frontCtx.fillStyle=q<.24?'#fffde5':q<.6?'#ffd474':'#b74b1b';frontCtx.beginPath();frontCtx.ellipse(px,py,r,r*(p.camera?1:1.35),p.seed*2,0,Math.PI*2);frontCtx.fill();
  }
  frontCtx.globalAlpha=1;

 }
return {render,clear};
}
