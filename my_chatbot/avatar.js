// ============================================================
//  avatar.js — Fixed head pose, blinking, laugh expressions
// ============================================================

const AVATAR_GLB_PATH = './avatar.glb';

let scene, camera, renderer, avatarModel;
let mixer;
let clock = new THREE.Clock();

let wolf3dHeadMesh = null, eyeLeftMesh = null, eyeRightMesh = null;
let headMorphMap = {}, eyeLMorphMap = {}, eyeRMorphMap = {};
let jawBone = null, neckBone = null, headBone = null;
let leftEyeBone = null, rightEyeBone = null;

// Gaze
let gazeHome        = new THREE.Vector2(0, 0);
let gazeDriftTarget = new THREE.Vector2(0, 0);
let currentGaze     = new THREE.Vector2(0, 0);
let mouseNudge      = new THREE.Vector2(0, 0);
let isLookingAway   = false;
let lookAwayTimer   = 0;

// Lip sync
let isSpeaking = false, syllablePhase = 0, syllableTimer = 0, syllableDuration = 0;
let jawCurrentRot = 0, jawTargetRot = 0;

// Morphs
let headTargets = {}, eyeLTargets = {}, eyeRTargets = {};

// Head bone — BASE offset applied permanently to fix chin-raised pose
// then animation targets are added on top
const HEAD_BASE_ROT_X = 0.18;  // tilt head DOWN this much permanently
let headAnimRotX = 0, headAnimRotY = 0, headAnimRotZ = 0;
let headCurRotX  = 0, headCurRotY  = 0, headCurRotZ  = 0;

// Emotion
let currentEmotion     = 'neutral';
let emotionSmileTarget = 0.06;

// Idle
let idleTimer = 0, nextIdleMs = 3000;

// Blink
let blinkState     = 0;    // 0=open, 1=closing, 2=opening
let blinkProgress  = 0;
let nextBlinkMs    = 1200 + Math.random() * 1600;
let blinkTimer     = 0;

// Poke/reaction
let isReacting  = false;
let reactionIdx = 0;

// ─── TALKING TOM REACTIONS ─────────────────────────────────
const REACTIONS = [
  {
    sound: () => reactionSpeak(['Oh!','Hey!','Whoa!','Ow!'][~~(Math.random()*4)], 1.3, 1.4),
    anim: () => {
      headAnimRotX = -0.20; setTimeout(()=>{headAnimRotX=0.08;},160); setTimeout(()=>{headAnimRotX=0;},380);
      gazeDriftTarget.set(0, 0.22); setTimeout(()=>gazeDriftTarget.set(gazeHome.x,gazeHome.y), 650);
      flashMouth(0.65, 280);
    }
  },
  {
    sound: () => reactionSpeak(['Hehe!','Ha!','Hahaha!','Tee hee!'][~~(Math.random()*4)], 1.45, 1.5),
    anim: () => {
      doLaugh();
    }
  },
  {
    sound: () => reactionSpeak(['Hey!','Stop that!','Ugh!','Hmph!'][~~(Math.random()*4)], 0.88, 0.82),
    anim: () => {
      doHeadShake(1.3); emotionSmileTarget = 0.0;
      setTimeout(()=>{ emotionSmileTarget = smileForEmotion(); }, 1500);
      gazeDriftTarget.set(0.25, gazeHome.y); setTimeout(()=>gazeDriftTarget.set(gazeHome.x,gazeHome.y), 1100);
    }
  },
  {
    sound: () => reactionSpeak(['Woah...','Ooooh...','Whoa!'][~~(Math.random()*3)], 0.88, 1.1),
    anim: () => {
      headAnimRotZ=0.18; setTimeout(()=>{headAnimRotZ=-0.14;},260); setTimeout(()=>{headAnimRotZ=0.09;},520); setTimeout(()=>{headAnimRotZ=0;},780);
      gazeDriftTarget.set(0.22, 0.18); setTimeout(()=>gazeDriftTarget.set(-0.18,-0.14),320); setTimeout(()=>gazeDriftTarget.set(gazeHome.x,gazeHome.y),800);
    }
  },
  {
    sound: () => reactionSpeak(['Mwah!','Aww!'][~~(Math.random()*2)], 1.1, 1.35),
    anim: () => {
      emotionSmileTarget = 0.75; doHeadNod(0.6);
      flashMouth(0.18, 450);
      setTimeout(()=>{ emotionSmileTarget = smileForEmotion(); }, 1300);
    }
  },
  {
    sound: () => reactionSpeak(['Hahaha!','Stop! Haha!','That tickles!'][~~(Math.random()*3)], 1.3, 1.4),
    anim: () => { doHeadShake(0.9); setTimeout(doHeadShake, 420, 0.6); doLaugh(); }
  },
];

function doLaugh() {
  // Rapid nod sequence = laughing
  doHeadNod(1.0);
  setTimeout(()=>doHeadNod(0.8), 320);
  setTimeout(()=>doHeadNod(0.55), 640);
  // Big open smile
  emotionSmileTarget = 0.95;
  flashMouth(0.55, 200);
  setTimeout(()=>flashMouth(0.45, 200), 340);
  setTimeout(()=>{ emotionSmileTarget = smileForEmotion(); }, 1400);
  // Eyes squint down slightly (happy squint)
  gazeDriftTarget.set(0, gazeHome.y - 0.06);
  setTimeout(()=>gazeDriftTarget.set(gazeHome.x, gazeHome.y), 900);
}

function flashMouth(openVal, durationMs) {
  setHeadMorph('mouthOpen', openVal);
  if (jawBone) { jawTargetRot = openVal * 0.28; }
  setTimeout(()=>{
    setHeadMorph('mouthOpen', 0);
    jawTargetRot = 0;
  }, durationMs);
}

function smileForEmotion() {
  const m = {neutral:0.06,happy:0.65,excited:0.90,curious:0.12,amused:0.80,thinking:0.02,sad:0.00,disagreeing:0.08};
  return m[currentEmotion] ?? 0.06;
}

function handleAvatarPoke() {
  if (isReacting) return;
  isReacting = true;
  window.speechSynthesis.cancel();
  stopLipSync();
  const r = (reactionIdx++ % 3 === 0)
    ? REACTIONS[~~(Math.random() * REACTIONS.length)]
    : REACTIONS[reactionIdx % REACTIONS.length];
  r.anim();
  setTimeout(()=>r.sound(), 55);
  setTimeout(()=>{ isReacting = false; }, 1700);
}

function reactionSpeak(text, rate, pitch) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate; u.pitch = pitch; u.volume = 1.0;
  const v = window.speechSynthesis.getVoices().find(v=>/samantha|karen|moira|zira|nova|female|woman/i.test(v.name));
  if (v) u.voice = v;
  u.onstart = ()=>{ setHeadMorph('mouthOpen', 0.72); if(jawBone) jawBone.rotation.x = 0.22; };
  u.onend   = ()=>{ setHeadMorph('mouthOpen', 0); if(jawBone){jawBone.rotation.x=0;} jawCurrentRot=0; jawTargetRot=0; };
  window.speechSynthesis.speak(u);
}

// ─── INIT ──────────────────────────────────────────────────
function initAvatar() {
  const viewport = document.getElementById('avatar-viewport');
  const canvas   = document.getElementById('avatar-canvas');
  const w = viewport.clientWidth, h = viewport.clientHeight;

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(22, w / h, 0.001, 1000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding     = THREE.sRGBEncoding;
  renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xfff8f0, 1.4);
  key.position.set(0.8, 1.5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xaac0ff, 0.4);
  fill.position.set(-3, 0.5, 2); scene.add(fill);

  loadAvatar();
  animate();

  canvas.addEventListener('click',      handleAvatarPoke);
  canvas.addEventListener('touchstart', handleAvatarPoke, {passive:true});
  canvas.style.cursor = 'pointer';

  document.addEventListener('mousemove', (e) => {
    mouseNudge.x =  ((e.clientX / window.innerWidth)  * 2 - 1) * 0.032;
    mouseNudge.y = -((e.clientY / window.innerHeight) * 2 - 1) * 0.018;
  });

  startIdleGazeDrift();
}

// ─── LOAD ──────────────────────────────────────────────────
function loadAvatar() {
  new THREE.GLTFLoader().load(AVATAR_GLB_PATH,
    (gltf) => {
      avatarModel = gltf.scene;
      scene.add(avatarModel);

      const box    = new THREE.Box3().setFromObject(avatarModel);
      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      avatarModel.position.set(-center.x, -center.y, -center.z);

      avatarModel.traverse((node) => {
        if (node.isMesh && node.morphTargetDictionary) {
          if (node.name==='Wolf3D_Head'){ wolf3dHeadMesh=node; headMorphMap=node.morphTargetDictionary; }
          if (node.name==='EyeLeft')   { eyeLeftMesh=node;  eyeLMorphMap=node.morphTargetDictionary; }
          if (node.name==='EyeRight')  { eyeRightMesh=node; eyeRMorphMap=node.morphTargetDictionary; }
        }
        if (node.type==='Bone'||node.isBone) {
          const nl=node.name.toLowerCase();
          if (nl==='jaw'||nl.includes('jaw')) jawBone=node;
          if (nl==='neck')  neckBone=node;
          if (nl==='head')  headBone=node;
          if (nl==='lefteye')  leftEyeBone=node;
          if (nl==='righteye') rightEyeBone=node;
        }
      });

      // ── FIX HEAD POSE: tilt neck bone DOWN immediately ──
      // This permanently counters the chin-raised default pose
      // We set the bone directly; our updateHeadBone() adds animation on top
      const poseBone = neckBone || headBone;
      if (poseBone) {
        poseBone.rotation.x = HEAD_BASE_ROT_X;
        console.log('Applied base head tilt to:', poseBone.name);
      }

      // ── CAMERA: frame chin to forehead, aim at eyes ──
      // After centering + head tilted down, skull is still at model top
      // We just need a tighter frame and correct lookAt
      const modelTop = size.y * 0.5;
      const skullTop = modelTop - size.y * 0.02;
      const chinBot  = modelTop - size.y * 0.16;
      const eyeY     = modelTop - size.y * 0.075;  // eye level
      // Look exactly at eye level — avatar faces straight at camera
      const lookAtY  = eyeY;
      const frameH   = (skullTop - chinBot) * 2.20;  // wider = shows neck+shoulders
      const fovRad   = (camera.fov * Math.PI) / 180;
      const dist     = (frameH / 2) / Math.tan(fovRad / 2);

      camera.position.set(0, lookAtY, dist);
      camera.lookAt(0, lookAtY, 0);

      gazeHome.set(0, 0);
      gazeDriftTarget.copy(gazeHome);
      currentGaze.copy(gazeHome);

      console.log(`H:${size.y.toFixed(3)} | lookAt:${lookAtY.toFixed(3)} | CamZ:${dist.toFixed(3)}`);

      if (gltf.animations?.length > 0) {
        mixer = new THREE.AnimationMixer(avatarModel);
        // Don't autoplay idle animations — they override our bone rotations
        // mixer.clipAction(gltf.animations[0]).play();
      }

      setStatus('Ready to chat');
    },
    (p) => { if(p.total>0) setStatus('Loading... '+Math.round(p.loaded/p.total*100)+'%'); },
    (err) => { console.error(err); setStatus('avatar.glb not found'); }
  );
}

// ─── ANIMATE ───────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const t     = clock.getElapsedTime();
  if (avatarModel) avatarModel.position.y += Math.sin(t*1.1)*0.00006;
  updateHeadBone(delta, t);
  updateBlink(delta);
  updateGaze(delta);
  updateIdleAnimations(delta);
  updateLipSync(delta);
  applyAllMorphLerps(delta);
  renderer.render(scene, camera);
}

// ─── HEAD BONE ─────────────────────────────────────────────
function updateHeadBone(delta, t) {
  const bone = neckBone || headBone;
  if (!bone) return;
  const spd = 4.0;
  headCurRotX += (headAnimRotX - headCurRotX) * Math.min(1, delta*spd);
  headCurRotY += (headAnimRotY - headCurRotY) * Math.min(1, delta*spd);
  headCurRotZ += (headAnimRotZ - headCurRotZ) * Math.min(1, delta*spd);
  // Base tilt (fixes pose) + animation offset + micro alive sway
  bone.rotation.x = HEAD_BASE_ROT_X + headCurRotX + Math.sin(t*0.55)*0.005;
  bone.rotation.y = headCurRotY + Math.sin(t*0.30)*0.006;
  bone.rotation.z = headCurRotZ + Math.sin(t*0.42)*0.004;
}

function doHeadNod(i)   { i=i||1; headAnimRotX=-0.09*i; setTimeout(()=>{headAnimRotX=0.03*i;},210); setTimeout(()=>{headAnimRotX=0;},430); }
function doHeadShake(i) { i=i||1; headAnimRotY=-0.09*i; setTimeout(()=>{headAnimRotY=0.09*i;},250); setTimeout(()=>{headAnimRotY=-0.05*i;},490); setTimeout(()=>{headAnimRotY=0;},690); }
function doHeadTilt(d)  { d=d||1; headAnimRotZ=0.065*d; setTimeout(()=>{headAnimRotZ=0;},1500); }

// ─── BLINK (smooth lerp, not instant snap) ─────────────────
function updateBlink(delta) {
  blinkTimer += delta * 1000;
  if (blinkState === 0) {
    // Waiting to blink
    if (blinkTimer >= nextBlinkMs) {
      blinkTimer = 0;
      blinkState = 1;  // start closing
      blinkProgress = 0;
      nextBlinkMs = 1200 + Math.random() * 1600;
    }
  } else if (blinkState === 1) {
    // Closing eyelids
    blinkProgress += delta * 18;  // close in ~55ms
    const v = Math.min(1, blinkProgress);
    applyBlinkValue(v);
    if (blinkProgress >= 1) { blinkState = 2; blinkProgress = 0; }
  } else if (blinkState === 2) {
    // Opening eyelids
    blinkProgress += delta * 11;  // open in ~90ms
    const v = 1 - Math.min(1, blinkProgress);
    applyBlinkValue(v);
    if (blinkProgress >= 1) { blinkState = 0; applyBlinkValue(0); }
  }
}

// NO BLINK MORPHS on this avatar — use eye bone Y-scale to squish eyes shut
const BLINK_MORPH_NAMES = []; // empty — no blink morphs exist

function applyBlinkValue(v) {
  // v=0: eyes open, v=1: eyes closed
  // Squish eye bones vertically to simulate closing
  const scaleY = 1.0 - v * 0.95; // at v=1, scaleY=0.05 (almost flat)
  if (leftEyeBone)  leftEyeBone.scale.set(1, scaleY, 1);
  if (rightEyeBone) rightEyeBone.scale.set(1, scaleY, 1);
  // Also squish the eye MESHES directly if bones don't work
  if (eyeLeftMesh)  eyeLeftMesh.scale.set(1, scaleY, 1);
  if (eyeRightMesh) eyeRightMesh.scale.set(1, scaleY, 1);
}

// Keep old triggerBlink for reaction use
function triggerBlink() { blinkState=1; blinkProgress=0; blinkTimer=0; }

// ─── IDLE ──────────────────────────────────────────────────
function updateIdleAnimations(delta) {
  if (isSpeaking || isReacting) return;
  idleTimer += delta*1000; if (idleTimer<nextIdleMs) return;
  idleTimer=0; nextIdleMs=3000+Math.random()*4000;
  const roll=Math.random();
  if      (roll<0.20) { isLookingAway=true; lookAwayTimer=700+Math.random()*800; gazeDriftTarget.set((Math.random()>0.5?1:-1)*(0.14+Math.random()*0.18),(Math.random()-0.5)*0.10); }
  else if (roll<0.38) { doHeadTilt(Math.random()>0.5?1:-1); }
  else if (roll<0.52) { triggerBlink(); }
  else if (roll<0.65) { doHeadNod(0.4); }
  else if (roll<0.78) { gazeDriftTarget.y=gazeHome.y+0.13; setTimeout(()=>{gazeDriftTarget.y=gazeHome.y;},900+Math.random()*500); }
  else                { gazeDriftTarget.y=gazeHome.y-0.09; setTimeout(()=>{gazeDriftTarget.y=gazeHome.y;},600+Math.random()*400); }
}

// ─── EMOTION ───────────────────────────────────────────────
function setEmotion(emotion) {
  currentEmotion = emotion;
  switch (emotion) {
    case 'happy':
      emotionSmileTarget=0.65; doHeadNod(0.8);
      gazeDriftTarget.set(0,gazeHome.y+0.08); setTimeout(()=>gazeDriftTarget.set(gazeHome.x,gazeHome.y),900);
      break;
    case 'excited':
      emotionSmileTarget=0.90; doHeadNod(1.0); setTimeout(()=>doHeadNod(0.65),500);
      flashMouth(0.4, 250);
      gazeDriftTarget.set(0,gazeHome.y+0.16); setTimeout(()=>gazeDriftTarget.set(gazeHome.x,gazeHome.y),700);
      break;
    case 'curious':
      emotionSmileTarget=0.12; doHeadTilt(1);
      gazeDriftTarget.set(0,gazeHome.y+0.04); setTimeout(triggerBlink,350);
      break;
    case 'amused':
      emotionSmileTarget=0.80; doLaugh();
      break;
    case 'thinking':
      emotionSmileTarget=0.02; doHeadTilt(-1);
      gazeDriftTarget.set(-0.18,gazeHome.y+0.17);
      setTimeout(triggerBlink,400); setTimeout(triggerBlink,950);
      setTimeout(()=>{if(currentEmotion==='thinking')gazeDriftTarget.set(gazeHome.x,gazeHome.y);},2300);
      break;
    case 'sad':
      emotionSmileTarget=0.00;
      headAnimRotX=0.06; setTimeout(()=>{headAnimRotX=0;},3000);
      gazeDriftTarget.set(0,gazeHome.y-0.14); setTimeout(()=>gazeDriftTarget.set(gazeHome.x,gazeHome.y),2500);
      setTimeout(triggerBlink,700);
      break;
    case 'disagreeing':
      emotionSmileTarget=0.08; doHeadShake(1.0);
      gazeDriftTarget.set(0,gazeHome.y);
      break;
    default:
      emotionSmileTarget=0.06; gazeDriftTarget.set(gazeHome.x,gazeHome.y);
      break;
  }
}

// ─── GAZE ──────────────────────────────────────────────────
function startIdleGazeDrift() {
  (function drift() {
    if (!isLookingAway&&currentEmotion==='neutral') gazeDriftTarget.set(gazeHome.x+(Math.random()-0.5)*0.06,gazeHome.y+(Math.random()-0.5)*0.03);
    setTimeout(drift, 2500+Math.random()*2000);
  })();
}
function updateGaze(delta) {
  if (isLookingAway) { lookAwayTimer-=delta*1000; if(lookAwayTimer<=0){isLookingAway=false;gazeDriftTarget.set(gazeHome.x,gazeHome.y);} }
  currentGaze.x += (gazeDriftTarget.x+mouseNudge.x-currentGaze.x)*Math.min(1,delta*2.2);
  currentGaze.y += (gazeDriftTarget.y+mouseNudge.y-currentGaze.y)*Math.min(1,delta*2.2);
  const gx=THREE.MathUtils.clamp(currentGaze.x,-0.28,0.28);
  const gy=THREE.MathUtils.clamp(currentGaze.y,-0.18,0.18);
  if(leftEyeBone)  leftEyeBone.rotation.set( gy*0.4,gx*0.4,0);
  if(rightEyeBone) rightEyeBone.rotation.set(gy*0.4,gx*0.4,0);
  setEyeLMorph('eyeLookLeft',Math.max(0,-gx)); setEyeLMorph('eyeLookRight',Math.max(0,gx));
  setEyeLMorph('eyeLookUp',  Math.max(0, gy)); setEyeLMorph('eyeLookDown', Math.max(0,-gy));
  setEyeRMorph('eyeLookLeft',Math.max(0,-gx)); setEyeRMorph('eyeLookRight',Math.max(0,gx));
  setEyeRMorph('eyeLookUp',  Math.max(0, gy)); setEyeRMorph('eyeLookDown', Math.max(0,-gy));
}

// ─── MORPHS ────────────────────────────────────────────────
function setHeadMorph(n,v){ headTargets[n]=Math.max(0,Math.min(1,v)); }
function setEyeLMorph(n,v){ eyeLTargets[n]=Math.max(0,Math.min(1,v)); }
function setEyeRMorph(n,v){ eyeRTargets[n]=Math.max(0,Math.min(1,v)); }
function applyMorphLerp(mesh,map,targets,delta) {
  if(!mesh?.morphTargetInfluences)return;
  for(const n in map){
    const idx=map[n],tgt=targets[n]||0,cur=mesh.morphTargetInfluences[idx]||0;
    mesh.morphTargetInfluences[idx]=cur+(tgt-cur)*Math.min(1,delta*20);
  }
}
function applyAllMorphLerps(delta) {
  if(!isSpeaking&&!isReacting) setHeadMorph('mouthSmile',emotionSmileTarget);
  applyMorphLerp(wolf3dHeadMesh,headMorphMap,headTargets,delta);
  applyMorphLerp(eyeLeftMesh,  eyeLMorphMap,eyeLTargets,delta);
  applyMorphLerp(eyeRightMesh, eyeRMorphMap,eyeRTargets,delta);
}

// ─── LIP SYNC ──────────────────────────────────────────────
const SYL=[()=>({o:0.90,j:0.27,d:88+rr(80)}),()=>({o:0.74,j:0.21,d:80+rr(72)}),()=>({o:0.56,j:0.16,d:72+rr(64)}),()=>({o:0.38,j:0.11,d:64+rr(56)}),()=>({o:0.22,j:0.07,d:56+rr(48)}),()=>({o:0.10,j:0.03,d:48+rr(40)}),()=>({o:0.04,j:0.01,d:42+rr(34)}),];
function rr(n){return Math.random()*n;}
function updateLipSync(delta) {
  if(jawBone){jawCurrentRot+=(jawTargetRot-jawCurrentRot)*Math.min(1,delta*24);jawBone.rotation.x=jawCurrentRot;}
  if(!isSpeaking){jawTargetRot=0;setHeadMorph('mouthOpen',0);return;}
  syllableTimer+=delta*1000;if(syllableTimer<syllableDuration)return;syllableTimer=0;
  if(syllablePhase===0){const s=SYL[~~rr(5)]();setHeadMorph('mouthOpen',s.o);setHeadMorph('mouthSmile',emotionSmileTarget*0.35);jawTargetRot=s.j;syllableDuration=s.d;syllablePhase=1;}
  else if(syllablePhase===1){const s=SYL[3+~~rr(4)]();setHeadMorph('mouthOpen',s.o);jawTargetRot=s.j;syllableDuration=s.d;syllablePhase=2;}
  else{const p=Math.random()<0.13;setHeadMorph('mouthOpen',0.004);jawTargetRot=0.001;syllableDuration=p?180+rr(140):22+rr(48);syllablePhase=0;}
}
function startLipSync(){isSpeaking=true;syllablePhase=0;syllableTimer=0;syllableDuration=0;headAnimRotX=-0.015;document.getElementById('mouth-indicator').classList.add('speaking');setStatus('Speaking...','speaking');}
function stopLipSync(){
  isSpeaking=false;jawTargetRot=0;jawCurrentRot=0;
  if(jawBone)jawBone.rotation.x=0;
  headTargets['mouthOpen']=0;
  if(wolf3dHeadMesh?.morphTargetInfluences){const idx=headMorphMap['mouthOpen'];if(idx!==undefined)wolf3dHeadMesh.morphTargetInfluences[idx]=0;}
  headAnimRotX=0;
  document.getElementById('mouth-indicator').classList.remove('speaking');setStatus('Ready to chat');
}

function setStatus(text,cls){const el=document.getElementById('avatar-status');if(!el)return;el.textContent=text;el.className='avatar-status '+(cls||'');}

window.addEventListener('load',initAvatar);
window.addEventListener('resize',()=>{const vp=document.getElementById('avatar-viewport');camera.aspect=vp.clientWidth/vp.clientHeight;camera.updateProjectionMatrix();renderer.setSize(vp.clientWidth,vp.clientHeight);});
