// Gift Runner - Flow復活 + ゴール人物拡大 + 背景は進行距離で切替（coverフィット）
// - assets/flow の .png/.jpg/.jpeg/.heic（サブフォルダ含む）を検出して右→左へ常時流す（当たると即GameOver）
// - 背景は"時間ではなく"プレイヤーの進行距離に応じてフェード切替（一定距離ごと）
// - 背景画像は cover スケールで自動フィット
// - 主人公は右向き開始、走行は run_a/run_b トグル、空中は jump

const GAME_W = 960, GAME_H = 540;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

class Boot extends Phaser.Scene{
  constructor(){super('boot');}

  preload(){
    this.load.json('cfg','assets/config.json');

    // 主人公
    this.load.image('hero_stand','assets/hero/standing.png');
    this.load.image('hero_run_a','assets/hero/run_a.png');
    this.load.image('hero_run_b','assets/hero/run_b.png');
    this.load.image('hero_jump','assets/hero/jump.png');
    this.load.image('hero_single_snake','assets/hero/hero_single.png');
    this.load.image('hero_single_kebab','assets/hero/hero-single.png');

    // ゴール / フォールバック
    this.load.image('goal_person_png','assets/goal/goal.png');
    this.load.image('goal_person_jpg','assets/goal/goal.jpg');
    this.load.image('goal_person_jpeg','assets/goal/goal.jpeg');
    this.load.image('goal_person_alt','assets/goal/person.png');
    this.load.image('bg_single','assets/bg/tokyo.png'); // 無くてもPlayで無地生成

    // Test hardcoded flow image
    this.load.image('test_flow_image', 'assets/flow/IMG_0713.jpg');
  }

  create(){
    const cfg=this.cache.json.get('cfg')||{};

    // 背景/固定写真/手動flow
    (cfg.backgroundSegments||[]).forEach(b=> b?.key&&b?.path && this.load.image(b.key,b.path));
    (cfg.bgCycle||[]).forEach(b=> b?.key&&b?.path && this.load.image(b.key,b.path));
    (cfg.photos||[]).forEach((p,i)=> this.load.image(`photo_${i}`, p.img));

    // ★ flow画像を確実に読み込む
    if(cfg.flow && Array.isArray(cfg.flow)){
      console.log('[Boot] Loading', cfg.flow.length, 'flow images from config');
      cfg.flow.forEach((path,i)=> {
        const key = `flow_cfg_${i}`;
        console.log('[Boot] Loading flow image:', key, path);
        this.load.image(key, path);
      });
    }

    this.load.once('complete', ()=>{
      console.log('[Boot] Initial load complete, starting play scene');
      this.scene.start('play',{cfg});
      // 非同期スキャン（flow/bg）
      this._discoverAndLoadFlow('assets/flow');
      this._discoverAndLoadBG('assets/bg');
    });
    this.load.start();
  }

  // ------- directory crawler (max depth=2) -------
  async _crawlDir(baseDir, allowHeic){
    const found = new Set();
    const add=(u)=>{ if(!found.has(u)) found.add(u); };
    const norm=(raw,dir)=>{
      let href = decodeURIComponent(raw).replace(/[?#].*$/,'');
      if (/^(https?:)?\/\//i.test(href)) return href;
      if (href.startsWith('/')) return href.slice(1);
      if (href.includes('/')) return href;
      return `${dir}/${href}`;
    };
    const fileRe = allowHeic ? /\.(png|jpe?g|heic)$/i : /\.(png|jpe?g)$/i;

    const walk = async (dir, depth)=>{
      if(depth<0) return;
      try{
        const res = await fetch(`${dir}/`,{cache:'no-store'});
        if(!res.ok) return;
        const html = await res.text();
        const re = /href=["']([^"']+)["']/gi; let m;
        const subs=[];
        while((m=re.exec(html))){
          const href = m[1];
          if(/\/$/.test(href) && href!=='../' && href!=='./'){
            const sub = norm(href.replace(/\/$/,''), dir);
            if(sub.startsWith(baseDir)) subs.push(sub);
            continue;
          }
          if(fileRe.test(href)) add(norm(href,dir));
        }
        for(const s of subs) await walk(s, depth-1);
      }catch(_e){}
    };

    await walk(baseDir, 2);
    return Array.from(found);
  }

  // ------- flow discover & load (.png/.jpg/.jpeg/.heic) -------
  async _discoverAndLoadFlow(dir){
    console.log('[Flow] Starting discovery for:', dir);
    let urls = await this._crawlDir(dir, true);
    console.log('[Flow] Crawl found:', urls.length, 'files');

    if(!urls.length){
      console.log('[Flow] Trying brute force discovery...');
      // fallback brute - 広範囲な探索で自動検出
      const exts = ['png','jpg','jpeg','heic','PNG','JPG','JPEG','HEIC'];

      // 非常に多くのプレフィックスパターンに対応
      const prefixes=[
        '', 'IMG_', 'PXL_', 'DSC_', 'DCS_', 'photo_', 'image_', 'img_', 'pic_',
        'flow_', 'TAKEBE', '360_F_', 'DCIM_', 'Photo_', 'Picture_', 'photo',
        'Image_', 'P_', 'F_', 'Pic_', 'Screenshot_', 'snap_', 'shot_'
      ];

      const tries=[];

      // 既存ファイルの検出（現在flowフォルダにあるファイル名パターン）
      const knownFiles = [
        'TAKEBE160224230I9A0524_TP_V',
        '360_F_488939351_Fiz02PYpwJuyfJC5qq3b8W30B2He5if6',
        '5572ebc4949b5d5903c1e86cee471805_t',
        '5572ebc4949b5d5903c1e86cee471805',
        '86f122b7e6162287e99fb9549b0f37ad_t',
        '86f122b7e6162287e99fb9549b0f37ad',
        'ba4cdaf55b9e10573ec97a2f9193e603_t',
        'ba4cdaf55b9e10573ec97a2f9193e603',
        'e9f664380b5b7b1da9e8deba67f8e020_t',
        'e9f664380b5b7b1da9e8deba67f8e020',
        'IMG_0713'
      ];

      // 既知のファイル名を優先的に試す
      knownFiles.forEach(name => {
        exts.forEach(e => tries.push(`${dir}/${name}.${e}`));
      });

      // 数字付きファイル名を試す（0〜2000まで、現実的な範囲）
      const pads=[0,1,2,3,4,5];
      for(const p of prefixes){
        for(const pad of pads){
          // 範囲を絞って効率化
          const maxNum = (p === '' || p === 'flow_') ? 100 : 2000;
          for(let n=0;n<=maxNum;n+=1){
            const num = pad ? String(n).padStart(pad,'0') : String(n);
            for(const e of exts) tries.push(`${dir}/${p}${num}.${e}`);
          }
        }
      }

      console.log('[Flow] Trying', tries.length, 'potential files...');

      // 最大5000ファイルまで試す
      const pick = tries.slice(0, 5000);
      await Promise.allSettled(pick.map(u=>
        fetch(u,{cache:'no-store'}).then(r=>{ if(r.ok) urls.push(u); })
      ));
      urls = Array.from(new Set(urls));
      console.log('[Flow] Brute force found:', urls.length, 'files');
    }
    if(!urls.length) {
      console.warn('[Flow] No images found!');
      return;
    }
    console.log('[Flow] Total files to load:', urls.length);

    let idx=0;
    const pump=()=>{
      const batch=urls.slice(idx, idx+18);
      if(!batch.length) {
        console.log('[Flow] All files loaded! Total:', idx);
        return;
      }

      const nonHeic=[], heic=[];
      batch.forEach(u => (/\.heic$/i.test(u) ? heic : nonHeic).push(u));

      nonHeic.forEach((u,j)=>{
        const key=`flow_auto_${idx+j}`;
        if(!this.textures.exists(key)) {
          console.log('[Flow] Loading:', key, u);
          this.load.image(key,u);
        }
      });

      const conv = heic.map(async (u,j)=>{
        try{
          const key=`flow_auto_${idx+nonHeic.length+j}`;
          if(this.textures.exists(key) || !window.heic2any) return;
          const blob = await fetch(u,{cache:'no-store'}).then(r=>r.blob());
          const out = await window.heic2any({ blob, toType:'image/jpeg', quality:0.9 });
          const jpeg = Array.isArray(out)? out[0] : out;
          const dataUrl = await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(jpeg); });
          this.textures.addBase64(key, dataUrl);
        }catch(e){ console.warn('HEIC変換失敗',u,e); }
      });

      this.load.once('complete', ()=>{
        Promise.allSettled(conv).then(()=>{
          if((idx+18)<urls.length) this.time.delayedCall(80,pump,null,this);
        });
      });
      this.load.start();
      idx+=18;
    };
    pump();
  }

  // ------- bg discover & load (.png/.jpg/.jpeg) -------
  async _discoverAndLoadBG(dir){
    let urls = await this._crawlDir(dir, false);
    if(!urls.length){
      const exts = ['png','jpg','jpeg','PNG','JPG','JPEG'];
      const common=['tokyo','yokohama','kyoto','skytree','kusatsu','bg','back','city','street','night'];
      const tries=[];
      for(const b of common) for(const e of exts) tries.push(`${dir}/${b}.${e}`);
      for(let n=1;n<=200;n++){
        for(const e of exts){ tries.push(`${dir}/${String(n).padStart(2,'0')}.${e}`); tries.push(`${dir}/${n}.${e}`); }
      }
      const pick=tries.slice(0,800);
      await Promise.allSettled(pick.map(u=>fetch(u,{cache:'no-store'}).then(r=>{ if(r.ok) urls.push(u); })));
      urls = Array.from(new Set(urls));
    }
    if(!urls.length) return;

    let idx=0;
    const pump=()=>{
      const batch=urls.slice(idx, idx+18);
      if(!batch.length) return;
      batch.forEach((u,j)=>{
        const key=`bg_auto_${idx+j}`;
        if(!this.textures.exists(key)) this.load.image(key,u);
      });
      idx+=18;
      this.load.once('complete', ()=>{ if(idx<urls.length) this.time.delayedCall(60,pump,null,this); });
      this.load.start();
    };
    pump();
  }
}

class Play extends Phaser.Scene{
  constructor(){super('play');}
  init(d){this.cfg=d.cfg||{};}

  create(){
    const cfg=this.cfg, L=cfg.level||{}, photos=cfg.photos||[];

    // ===== 背景（cover + 進行距離で切替）=====
    const bgOpacity = (typeof cfg.bgOpacity==='number') ? cfg.bgOpacity : 0.65;
    let safeBGKey = 'bg_single';
    if (!this.textures.exists('bg_single')) {
      const g = this.make.graphics({ x:0, y:0, add:false });
      g.fillStyle(0x101318, 1).fillRect(0,0,32,32);
      g.generateTexture('__bg_fallback__', 32, 32);
      g.destroy();
      safeBGKey = '__bg_fallback__';
    }

    // ロード済みBGキー収集（backgroundSegments順）
    this.bgSegmentsData = ()=>{
      const segments = [];

      // 1) config のセグメント順で取得
      if (Array.isArray(this.cfg.backgroundSegments)) {
        for (const b of this.cfg.backgroundSegments) {
          if (b?.key && this.textures.exists(b.key)) {
            segments.push({
              key: b.key,
              start: b.start ?? 0,
              end: b.end ?? 0
            });
          }
        }
      }

      return segments;
    };

    // Image 2枚クロスフェード、coverフィット用関数
    this.bgFactor = 0.3; // パララックス係数
    this.bgA = this.add.image(GAME_W/2, GAME_H/2, safeBGKey).setScrollFactor(0).setAlpha(bgOpacity);
    this.bgB = this.add.image(GAME_W/2, GAME_H/2, safeBGKey).setScrollFactor(0).setAlpha(0);

    this._fitBG = (img,key)=>{
      const tex = this.textures.get(key).getSourceImage();
      const s = Math.max(GAME_W/tex.width, GAME_H/tex.height);
      img.setTexture(key).setScale(s).setPosition(GAME_W/2, GAME_H/2);
      img.__dispW = tex.width*s;  // 実表示幅
      img.__dispH = tex.height*s;
      img.__key = key;
    };

    const segments = this.bgSegmentsData();
    const firstKey = (segments.length > 0 && segments[0].key) || safeBGKey;
    this._fitBG(this.bgA, firstKey);
    this._fitBG(this.bgB, firstKey);
    this.bgActive = 'A';
    this.bgOpacity = bgOpacity;

    // 現在の背景を決定（スクロール位置から算出）
    this._currentBGFromScroll = (sx)=>{
      const segments = this.bgSegmentsData();
      if (!segments.length) return { key: safeBGKey, idx: -1 };

      // スクロール位置がどのセグメントに含まれるか探す
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (sx >= seg.start && sx < seg.end) {
          return { key: seg.key, idx: i };
        }
      }

      // 範囲外の場合は最後のセグメント
      const lastIdx = segments.length - 1;
      return { key: segments[lastIdx].key, idx: lastIdx };
    };

    // 実際にその背景へフェード切り替え
    this._bgApplyKey = (key)=>{
      if (!key || !this.textures.exists(key)) return;
      const front = (this.bgActive==='A')? this.bgA : this.bgB;
      const back  = (this.bgActive==='A')? this.bgB : this.bgA;

      if (front.__key === key) return; // 同じなら何もしない

      this._fitBG(back, key);
      back.setAlpha(0);

      this.tweens.add({ targets: front, alpha: 0,              duration: 600, ease:'Sine.inOut' });
      this.tweens.add({ targets: back,  alpha: this.bgOpacity, duration: 600, ease:'Sine.inOut' });

      this.bgActive = (this.bgActive==='A')? 'B' : 'A';
    };

    // 初期背景を設定（スクロール0から決定）
    {
      const { key, idx } = this._currentBGFromScroll(0);
      this._bgApplyKey(key);
      this._bgLastIdx = idx;
    }

    

    // ===== world / ground =====
    const lastPhotoX=photos.reduce((m,p)=>Math.max(m,p.x||0),0);
    this.goalX=Math.max((L.length||0)-600, lastPhotoX+1200, 3000);
    this.worldLen=Math.max(L.length||0, this.goalX+1200, 6000);
    this.cameras.main.setBounds(0,0,this.worldLen,GAME_H).roundPixels=true;

    // ステージの床の高さ（画面下から30pxの位置）
    this.groundY = (L.groundY ?? GAME_H - 30);
    this.groundH = 30; // 床の厚み

    // ステージの床を作成（真っ赤な床）
    const stageFloor = this.add.graphics().setDepth(1);

    // 床の本体（真っ赤） - groundYから下に向かって描画
    stageFloor.fillStyle(0xff0000, 1);
    stageFloor.fillRect(0, this.groundY, this.worldLen, this.groundH);

    // 床の上面（明るい赤で立体感）
    stageFloor.fillStyle(0xff4444, 1);
    stageFloor.fillRect(0, this.groundY, this.worldLen, 4);

    // 床の枠線
    stageFloor.lineStyle(2, 0xcc0000, 1);
    stageFloor.strokeRect(0, this.groundY, this.worldLen, this.groundH);

    console.log('[Stage] Ground created at Y:', this.groundY, 'Height:', this.groundH, 'WorldLen:', this.worldLen);

    // ===== player（右向き開始）=====
    this.player=this.add.container(160,this.groundY).setDepth(100);
    const hasStand=this.textures.exists('hero_stand');
    const srcTex = hasStand ? this.textures.get('hero_stand').getSourceImage()
      : (this.textures.exists('hero_single_snake') ? this.textures.get('hero_single_snake').getSourceImage()
        : this.textures.get('hero_single_kebab').getSourceImage());
    const TARGET_H=(cfg.heroTargetHeight||110);
    this.avatarBaseScale = TARGET_H/srcTex.height;

    const initialKey = hasStand ? 'hero_stand'
      : (this.textures.exists('hero_single_snake') ? 'hero_single_snake' : 'hero_single_kebab');
    this.hero=this.add.image(0,0,initialKey).setOrigin(0.5,1).setScale(this.avatarBaseScale);
    this.player.add(this.hero);
    this.heroFootOffset=0;

    this.facing = 1; // 右
    this.hero.scaleX = this.avatarBaseScale;
    this.hero.scaleY = this.avatarBaseScale;

    // anim state
    this.hasRunFrames=this.textures.exists('hero_run_a') && this.textures.exists('hero_run_b');
    this.hasJumpFrame=this.textures.exists('hero_jump');
    this.runKeys=['hero_run_a','hero_run_b'];
    this.runIndex=0; this.animTimer=0; this.animInterval=0.12;
    this.currentKey=initialKey;
    this.setHeroKey=(k)=>{ if(k!==this.currentKey){ this.hero.setTexture(k); this.currentKey=k; } };

    // physics/input
    this.vx=0; this.vy=0;
    this.speed=240; this.jumpPower=520;
    this.jumpsLeft=2; this.lastTime=this.time.now;
    this.coyoteTime=0.10; this.coyoteTimer=0;
    this.jumpBuffer=0.12; this.bufferTimer=0;
    this.cursors=this.input.keyboard.createCursorKeys();
    this.keyW=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keySPACE=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 裏技: Ctrl+A でTEST MODE（無敵モード）切り替え
    this.testMode = false;
    this.testModeText = null;
    this.keyA=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.input.keyboard.on('keydown-A', (event)=>{
      if(event.ctrlKey || event.metaKey){ // Ctrl+A または Cmd+A (Mac)
        event.preventDefault(); // ブラウザの「全選択」を防ぐ
        this.testMode = !this.testMode;
        console.log('[Test Mode]', this.testMode ? 'ON' : 'OFF');

        if(this.testMode){
          // TEST MODE表示を作成
          if(!this.testModeText){
            this.testModeText = this.add.text(20, 20, 'TEST MODE', {
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#ff6b6b',
              backgroundColor: '#000000',
              padding: { x: 10, y: 5 }
            }).setScrollFactor(0).setDepth(1000);
          }
          this.testModeText.setVisible(true);
        } else {
          // TEST MODE表示を非表示
          if(this.testModeText){
            this.testModeText.setVisible(false);
          }
        }
      }
    });

    // TEST MODE中の裏技: Ctrl+Z でゴール前にワープ
    this.keyZ=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.input.keyboard.on('keydown-Z', (event)=>{
      if((event.ctrlKey || event.metaKey) && this.testMode){ // TEST MODE中のみ
        event.preventDefault(); // ブラウザの「戻る」を防ぐ
        console.log('[Test Mode] Warping to goal!');
        this.player.x = this.goalX - 100; // ゴールの100px手前
        this.player.y = this.groundY;
        this.vy = 0;
        this.cameras.main.scrollX = this.player.x - GAME_W / 2; // カメラもワープ
      }
    });

    // ===== 固定写真 & 足場 =====
    this.solids=[];
    const pushSolid=(x,y,w,h)=>this.solids.push({x,y,w,h});
    photos.forEach((p,i)=>{
      const key=`photo_${i}`; if(!this.textures.exists(key)) return;
      const tex=this.textures.get(key).getSourceImage();
      const desiredW=130, s=desiredW/tex.width, h=tex.height*s;
      const x=p.x, yB=this.groundY-20, yT=yB-h;
      this.add.image(x,yB,key).setOrigin(0.5,1).setScale(s).setDepth(6);

      // キャプション背景
      const captionBg = this.add.graphics().setDepth(6);
      captionBg.fillStyle(0x000000, 0.8);
      captionBg.fillRoundedRect(x-desiredW/2-5, yB+3, desiredW+10, 22, 4);

      // テキストの画質を向上させる設定
      this.add.text(x,yB+14,p.caption||'',{
        fontSize: '10px',
        color: '#ffffff',
        align: 'center',
        wordWrap: {width: Math.max(100,desiredW)},
        fontStyle: 'bold',
        fontFamily: 'Arial, sans-serif',
        resolution: 2 // テキストの解像度を2倍にして鮮明に
      }).setOrigin(0.5,0.5).setDepth(7);
      pushSolid(x-desiredW/2,yT,desiredW,h);
    });
    (L.platforms||[]).forEach(p=>{
      const w = p.w, h = 12, x = p.x - w/2, y = p.y - h/2;
      const g = this.add.graphics().setDepth(5);
      g.lineStyle(2, 0x000000, 1);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(x, y, w, h, 4);
      g.strokeRoundedRect(x, y, w, h, 4);

      // 衝突判定は従来通り
      this.solids.push({ x, y: y, w, h });
    });

    // ===== ゴール（人物を大きく & 足を地面にピタッ）=====
    this.add.rectangle(this.goalX-40,this.groundY-80,6,120,0x9fb0c8).setDepth(6);
    this.add.rectangle(this.goalX+40,this.groundY-80,6,120,0x9fb0c8).setDepth(6);
    this.add.rectangle(this.goalX,this.groundY-140,86,6,0x7aa2f7).setDepth(6);
    this.add.triangle(this.goalX+40,this.groundY-140,0,0,0,24,28,12,0x68e0a3).setDepth(7);
    this.add.text(this.goalX,this.groundY-170,'GOAL',{fontSize:'14px',color:'#eaf3ff'}).setOrigin(0.5).setDepth(7);

    const gks=['goal_person_png','goal_person_jpg','goal_person_jpeg','goal_person_alt'];
    const gk=gks.find(k=>this.textures.exists(k));
    if(gk){
      const src=this.textures.get(gk).getSourceImage();
      // 主人公と同じサイズにする
      const heroHeight = (cfg.heroTargetHeight||110);
      const goalTargetH = heroHeight * 0.75;
      const scale=goalTargetH/src.height;

      // 足先が「this.groundY」にしっかり接地するように配置
      // setOrigin(0.5, 1) で画像の下端中央を基準点にする
      this.goalGirl=this.add.image(this.goalX, this.groundY, gk)
        .setOrigin(0.5, 1) // 下端中央が基準
        .setScale(scale)
        .setDepth(8);

      console.log('[Goal] Character size:', goalTargetH, 'Scale:', scale, 'Position Y:', this.groundY);

      // 吹き出しを追加
      const bubbleX = this.goalX;
      const bubbleY = this.groundY - goalTargetH - 40; // キャラクターの頭上
      const bubbleW = 140;
      const bubbleH = 60;

      // 吹き出しの背景（丸角の矩形）
      const bubble = this.add.graphics().setDepth(9);
      bubble.fillStyle(0xffffff, 1);
      bubble.lineStyle(3, 0x000000, 1);
      bubble.fillRoundedRect(bubbleX - bubbleW/2, bubbleY - bubbleH/2, bubbleW, bubbleH, 12);
      bubble.strokeRoundedRect(bubbleX - bubbleW/2, bubbleY - bubbleH/2, bubbleW, bubbleH, 12);

      // 吹き出しのしっぽ（三角形）
      bubble.fillStyle(0xffffff, 1);
      bubble.lineStyle(3, 0x000000, 1);
      const tailX = bubbleX - 10;
      const tailY = bubbleY + bubbleH/2;
      bubble.beginPath();
      bubble.moveTo(tailX, tailY);
      bubble.lineTo(tailX - 15, tailY + 20);
      bubble.lineTo(tailX + 10, tailY);
      bubble.closePath();
      bubble.fillPath();
      bubble.strokePath();

      // テキスト「おかえり〜」
      this.add.text(bubbleX, bubbleY, 'おかえり〜', {
        fontSize: '22px',
        fontWeight: 'bold',
        color: '#2c3e50',
        align: 'center'
      }).setOrigin(0.5).setDepth(10);

      this.tweens.add({
        targets:this.goalGirl, y:'-=3', angle:2, yoyo:true, repeat:-1, duration:650, ease:'Sine.inOut'
      });
    }


    // カメラ
    this.cameras.main.startFollow(this.player,true,0.15,0.15);

    // ===== flow（右→左）=====  ← ★復活・常時補充
    this.flowItems = [];
    this.flowMaxConcurrent = (cfg.flowMaxConcurrent ?? 6);

    this.flowKeysCollector = ()=>{
      const keys=[];
      // Add hardcoded test key
      if (this.textures.exists('test_flow_image')) {
        keys.push('test_flow_image');
      }
      // flow画像
      for(let i=0;i<16000;i++){ const k=`flow_auto_${i}`; if(this.textures.exists(k)) keys.push(k); }
      for(let i=0;i<4000;i++){ const k=`flow_cfg_${i}`;  if(this.textures.exists(k)) keys.push(k); }
      return keys;
    };

    // 使用済み画像を追跡（重複防止）
    this.flowUsedKeys = [];
    this.flowAvailableKeys = [];

    const countAlive = ()=> this.flowItems.reduce((n,f)=> n + (f.alive?1:0), 0);
    const maintainFlow = ()=>{
      const keys = this.flowKeysCollector();
      console.log('[Play] Flow keys available:', keys.length);
      if(!keys.length) {
        console.warn('[Play] No flow images loaded yet!');
        return;
      }
      let alive = countAlive();
      console.log('[Play] Alive flow items:', alive, '/ Max:', this.flowMaxConcurrent);
      if(alive < this.flowMaxConcurrent){
        this.spawnFlow(keys);
      }
    };
    this.time.addEvent({ delay: 1500, loop: true, callback: maintainFlow });
    maintainFlow();

    // update
    this.events.on('update',()=>{
      const dt = Math.min((this.time.now-(this._lastTime||this.time.now))/1000,0.033);
      this._lastTime=this.time.now;
      this.loop(dt);

      // 背景パララックス（cover画像のXオフセット）
      const sx=this.cameras.main.scrollX * this.bgFactor;
      const shift = (img)=>{ const maxOffset = Math.max(0,(img.__dispW||GAME_W)-GAME_W); img.x = GAME_W/2 - clamp(sx,0,maxOffset); };
      shift(this.bgA); shift(this.bgB);

      // 進行距離に応じた背景を反映（backgroundSegmentsのstart/endに基づく）
      {
        const scrollX = this.cameras.main.scrollX;
        const { key, idx } = this._currentBGFromScroll(scrollX);
        if (idx !== this._bgLastIdx) {
          this._bgApplyKey(key);
          this._bgLastIdx = idx;
        }
      }
    });
  }

  loop(dt){
    // 入力
    let targetVx=0;
    if(this.cursors.left.isDown)  targetVx=-this.speed;
    if(this.cursors.right.isDown) targetVx= this.speed;
    this.vx=targetVx;
    if(this.vx>0) this.facing=1; else if(this.vx<0) this.facing=-1;

    const justPressed=Phaser.Input.Keyboard.JustDown(this.cursors.up)
                      || Phaser.Input.Keyboard.JustDown(this.keySPACE)
                      || Phaser.Input.Keyboard.JustDown(this.keyW);
    if(justPressed) this.bufferTimer=this.jumpBuffer;

    // 物理
    const pw=40, ph=100;
    const aabb=(x,y)=>({x:x-pw/2,y:y-ph,w:pw,h:ph});
    const hit=(A,B)=>!(A.x+A.w<=B.x||A.x>=B.x+B.w||A.y+A.h<=B.y||A.y>=B.y+B.h);

    // X
    let nx=this.player.x + this.vx*dt;
    nx=clamp(nx,pw/2,this.worldLen-pw/2);
    let Ax=aabb(nx,this.player.y);
    for(const b of this.solids){
      const B={x:b.x,y:b.y,w:b.w,h:b.h};
      if(!hit(Ax,B)) continue;
      nx = (this.vx>0)? B.x-pw/2 : B.x+B.w+pw/2;
      Ax=aabb(nx,this.player.y);
    }

    // Y
    this.vy += 1200*dt;
    let ny=this.player.y + this.vy*dt;

    let grounded=false;
    if(ny>=this.groundY){ ny=this.groundY; this.vy=0; grounded=true; }

    let Ay=aabb(nx,ny);
    for(const b of this.solids){
      const B={x:b.x,y:b.y,w:b.w,h:b.h};
      if(!hit(Ay,B)) continue;
      const prevBottom=this.player.y, nextBottom=ny;
      const prevTop=this.player.y-ph, nextTop=ny-ph;
      const top=B.y, bottom=B.y+B.h;
      if(this.vy>0 && prevBottom<=top && nextBottom>=top){ ny=top; this.vy=0; grounded=true; }
      else if(this.vy<0 && prevTop>=bottom && nextTop<=bottom){ ny=bottom+ph; this.vy=0; }
      Ay=aabb(nx,ny);
    }

    // ジャンプ
    if(grounded || ny>=this.groundY-0.001){ this.coyoteTimer=this.coyoteTime; this.jumpsLeft=2; }
    else{ this.coyoteTimer=Math.max(0,this.coyoteTimer-dt); }
    if(this.bufferTimer>0) this.bufferTimer=Math.max(0,this.bufferTimer-dt);
    const canGroundJump=(grounded || ny>=this.groundY-0.001 || this.coyoteTimer>0) && this.jumpsLeft>0;
    const canAirJump=!grounded && ny<this.groundY-0.001 && this.jumpsLeft>0;
    if(this.bufferTimer>0){
      if(canGroundJump || (canAirJump && this.jumpsLeft===1)){
        this.vy=-this.jumpPower; this.jumpsLeft--; this.bufferTimer=0; ny-=1;
        if(this.hasJumpFrame) this.setHeroKey('hero_jump');
      }
    }

    // 反映
    this.player.setPosition(nx,ny);

    // flow 衝突（TEST MODEでは無効）
    if(!this.testMode){
      const P={x:nx-pw/2,y:ny-ph,w:pw,h:ph};
      for(const f of this.flowItems){
        if(!f.alive) continue;
        // Obstacle is in screen space, convert to world space for collision
        let obstacleWorldX;
        if (f.ctr.scrollFactorX === 0) { // Scrolling items (screen-space)
          obstacleWorldX = f.ctr.x + this.cameras.main.scrollX;
        } else { // Falling items (world-space)
          obstacleWorldX = f.ctr.x;
        }

        const B={x:obstacleWorldX - f.w/2, y:f.ctr.y - f.h/2, w:f.w, h:f.h};
        if(hit(P,B)){ this.scene.start('gameover',{reason:'思い出にぶつかってGOALに辿り着けなかった！'}); return; }
      }
    }

    // アニメ
    const moving = Math.abs(this.vx) > 2;
    this.hero.scaleX = this.avatarBaseScale * (this.facing>0 ? 1 : -1);
    this.hero.scaleY = this.avatarBaseScale;

    if(!grounded){
      if(this.hasJumpFrame) this.setHeroKey('hero_jump');
      else if(this.hasRunFrames) this.setHeroKey('hero_run_a');
      else this.setHeroKey('hero_stand');
      this.hero.y=this.heroFootOffset;
    }else if(moving){
      if(this.hasRunFrames){
        if (this.currentKey === 'hero_jump') this.setHeroKey(this.runKeys[this.runIndex]);
        this.animTimer += dt;
        if(this.animTimer >= this.animInterval){
          this.animTimer = 0;
          this.runIndex = 1 - this.runIndex;
          this.setHeroKey(this.runKeys[this.runIndex]);
        }
      }else{
        this.setHeroKey('hero_stand');
      }
      const bob = Math.sin((this.time.now/1000)*12) * 2;
      this.hero.y = this.heroFootOffset + bob;
    }else{
      this.setHeroKey('hero_stand');
      this.animTimer=0; this.hero.y=this.heroFootOffset;
    }

    // ゴール
    if(nx>=this.goalX-10){ this.scene.start('letter',{cfg:this.cfg}); return; }
  }

  // flow spawn
  spawnFlow(pool){
    const keys = pool || this.flowKeysCollector();
    if(!keys.length) return;

    // 未使用画像プールの初期化または再生成
    if(this.flowAvailableKeys.length === 0) {
      this.flowAvailableKeys = [...keys];
      console.log('[Spawn] New round: Reset available keys pool with', this.flowAvailableKeys.length, 'images');
    }

    // プールから1つ選んで削除（重複防止）
    const randomIndex = Math.floor(Math.random() * this.flowAvailableKeys.length);
    const key = this.flowAvailableKeys.splice(randomIndex, 1)[0];
    this.flowUsedKeys.push(key);

    console.log('[Spawn] Creating flow item with key:', key, '| Remaining:', this.flowAvailableKeys.length);

    const src = this.textures.get(key).getSourceImage();
    // プレイヤーが飛び越えられる適切な高さに調整
    // ランダムで小さめ(60-80px)、通常(80-100px)、大きめ(100-120px)
    const sizeType = Math.random();
    let targetH;
    if (sizeType < 0.5) {
      targetH = Phaser.Math.Between(60, 80); // 50%: 小さめ（避けやすい）
    } else if (sizeType < 0.85) {
      targetH = Phaser.Math.Between(80, 100); // 35%: 通常サイズ
    } else {
      targetH = Phaser.Math.Between(100, 120); // 15%: 大きめ（難易度UP）
    }
    const scale = targetH / src.height;
    const w = src.width * scale, h = src.height * scale;

    const isFalling = Math.random() < 0.3; // 30% chance to fall

    let xStart, yStart;
    if (isFalling) {
      xStart = this.cameras.main.scrollX + Phaser.Math.Between(100, GAME_W - 100); // World X coordinate
      yStart = -h/2;
    } else {
      xStart = GAME_W + 160;
      yStart = this.groundY - h/2;
    }

    const ctr = this.add.container(xStart, yStart).setDepth(3);
    if (!isFalling) { // Only scrolling items have scrollFactor 0
      ctr.setScrollFactor(0);
    }
    const img = this.add.image(0, 0, key).setOrigin(0.5, 0.5).setScale(scale).setAlpha(1.0);
    const outline = this.add.rectangle(0, 0, w + 8, h + 8, 0x000000, 0.35).setOrigin(0.5,0.5);
    ctr.add([outline, img]);

    const item = { ctr, w, h, alive:true };
    this.flowItems.push(item);

    if (isFalling) {
      const fallDuration = 1200 + Math.random() * 600;
      this.tweens.add({
        targets: ctr,
        y: this.groundY - h/2, // Land on ground
        duration: fallDuration,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          // Let it rest on the ground for a bit before disappearing
          this.time.delayedCall(2000, () => {
            item.alive = false;
            ctr.destroy();
          });
        }
      });
    } else {
      this.tweens.add({ targets: ctr, y: yStart - 4, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
      const flowSpeed = 320 * 0.8; // pixels/sec (0.8倍の速度)
      const dist = GAME_W + 320;
      const duration = (dist / flowSpeed) * 1000;
      this.tweens.add({
        targets: ctr, x: -160, duration, ease: 'Linear',
        onComplete: () => { item.alive=false; ctr.destroy(); }
      });
    }
  }
}

class Letter extends Phaser.Scene{
  constructor(){super('letter');}
  init(d){this.cfg=d.cfg||{};}
  create(){
    const pane=this.add.container(0,-GAME_H);
    const bg=this.add.rectangle(GAME_W/2,GAME_H/2,GAME_W,GAME_H,0x0f1218);
    const title=this.add.text(GAME_W/2,120,this.cfg.finalMessageTitle||'Message',{fontSize:'32px',color:'#b5d1ff'}).setOrigin(0.5);
    const body=this.add.text(60,180,this.cfg.finalMessageBody||'お疲れさま！',{fontSize:'20px',color:'#eaf3ff',wordWrap:{width:GAME_W-120}});
    pane.add([bg,title,body]);
    this.tweens.add({targets:pane,y:0,duration:900,ease:'Sine.easeOut'});
  }
}

class GameOver extends Phaser.Scene{
  constructor(){super('gameover');}
  init(d){ this.reason = d?.reason || '思い出にぶつかってGOALに辿り着けなかった！'; }
  create(){
    this.cameras.main.setBackgroundColor('#120b0b');
    this.add.text(GAME_W/2,GAME_H/2-60,'GAME OVER',{fontSize:'52px',color:'#ffb4b4'}).setOrigin(0.5);
    this.add.text(GAME_W/2,GAME_H/2,this.reason,{fontSize:'20px',color:'#ffe2e2',align:'center',wordWrap:{width:GAME_W-120}}).setOrigin(0.5);
    this.add.text(GAME_W/2,GAME_H/2+80,'Enter でリトライ',{fontSize:'20px',color:'#ffe2e2'}).setOrigin(0.5);
    this.input.keyboard.once('keydown-ENTER',()=>this.scene.start('boot'));
  }
}

new Phaser.Game({
  type: Phaser.WEBGL, // WebGLを明示的に指定して高画質に
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0e0f13',
  pixelArt: false,
  antialias: true,
  antialiasGL: true,
  scene: [Boot, Play, Letter, GameOver],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    resolution: window.devicePixelRatio || 1 // デバイスの解像度に合わせる
  },
  render: {
    antialias: true,
    antialiasGL: true,
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
    roundPixels: false, // サブピクセルレンダリングを有効化
    powerPreference: 'high-performance' // 高性能GPUを優先
  }
});
