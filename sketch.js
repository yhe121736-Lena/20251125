// ============================= 【全局變數與配置】 =============================
let bgm = null;
let amp = null;
let smoothedLevel = 0;
const BASE_FRAME_DELAY = 6;
let frameDelay = BASE_FRAME_DELAY; 

// 角色狀態
let playerX; 
let playerY; 
let playerState = "idle"; 
let facingRight = true; 

// 物理參數
const GROUND_Y_RATIO = 0.75; 
let GROUND_Y;
const MOVEMENT_SPEED = 5; 
const JUMP_FORCE = -18; 
const GRAVITY = 1.2; 
let yVelocity = 0; 
let isJumping = false; 
let isShooting = false; 

// 動畫資料結構 (確保 JUMP 路徑為 '1c/ju/all.png')
const ANIMATION_DATA = {
    // Idle/Walk/Run: 8幀, 61x70
    "idle": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [], frameCounter: 0, currentFrame: 0, sheet: null },
    "run": { path: '1c/run/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [], frameCounter: 0, currentFrame: 0, sheet: null },
    "walk": { path: '1c/walk/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [], frameCounter: 0, currentFrame: 0, sheet: null },
    "stop": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [], frameCounter: 0, currentFrame: 0, sheet: null }, 
    
    // Shoot: 15幀, 134x97
    "shoot": { path: '1c/shoot/all.png', numFrames: 15, frameW: 134, frameH: 97, frames: [], frameCounter: 0, currentFrame: 0, sheet: null }, 
    
    // **最終確定路徑：'1c/ju/all.png'**
    "jump": { path: '1c/ju/all.png', numFrames: 10, frameW: 61, frameH: 63, frames: [], frameCounter: 0, currentFrame: 0, sheet: null }, 
};

// ============================= 【載入】 =============================
function preload() {
    for (let key in ANIMATION_DATA) {
        let anim = ANIMATION_DATA[key];
        anim.sheet = loadImage(anim.path, 
            (img) => { 
                console.log(`[PASS] ${key} 圖片載入成功。寬度: ${img.width}`);
                extractFrames(key); 
            }, 
            (err) => {
                console.error(`[ERROR] 載入失敗 (404/CORS?): ${key} - ${anim.path}`, err);
            }
        );
    }
    try {
        bgm = loadSound('music.mp3');
    } catch (e) {
        console.warn('loadSound not available', e);
    }
}

// 函式：將單張 Sprite Sheet 圖片分割成幀圖片陣列
function extractFrames(animKey) {
    let anim = ANIMATION_DATA[animKey];
    
    if (!anim.sheet || anim.sheet.width < anim.frameW) {
         console.error(`[FAIL] ${animKey} 圖片載入失敗或圖片太小。寬度: ${anim.sheet ? anim.sheet.width : 'N/A'}`);
         return;
    }
    
    try {
        anim.sheet.loadPixels();
    } catch (e) {
        console.error(`[FAIL] ${animKey} 無法讀取像素。可能是 CORS 錯誤或檔案損壞。`, e);
        return;
    }

    const actualNumFrames = Math.floor(anim.sheet.width / anim.frameW);
    anim.numFrames = Math.min(anim.numFrames, actualNumFrames);
    
    for (let i = 0; i < anim.numFrames; i++) {
        try {
            anim.frames.push(anim.sheet.get(i * anim.frameW, 0, anim.frameW, anim.frameH));
        } catch(e) {
             console.error(`[FAIL] ${animKey} 幀提取失敗於第 ${i} 幀. 請檢查 frameW/frameH 是否超出圖片尺寸。`, e);
             return;
        }
    }
    console.log(`[PASS] ${animKey} 成功提取 ${anim.frames.length} 幀.`);
}

// ============================= 【設定】/【繪圖循環】/【鍵盤輸入】 =============================

function setup() {
    createCanvas(windowWidth, windowHeight);
    imageMode(CENTER);
    smooth();
    
    GROUND_Y = height * GROUND_Y_RATIO;
    playerX = width / 2;
    playerY = GROUND_Y; 

    if (bgm && bgm.setVolume) bgm.setVolume(0.6);
    try {
        amp = new p5.Amplitude();
        if (bgm) amp.setInput(bgm);
    } catch (e) {
        amp = null;
    }
}

function draw() {
    background('#FFD2D2');
    
    let effectiveDelay = BASE_FRAME_DELAY;
    if (bgm && bgm.isPlaying() && amp) {
        const level = amp.getLevel();
        smoothedLevel = lerp(smoothedLevel, level, 0.12);
        const speedFactor = map(smoothedLevel, 0, 0.2, 0.5, 2, true);
        effectiveDelay = Math.max(1, Math.round(BASE_FRAME_DELAY / speedFactor));
    }

    // A. 物理 (跳躍和重力)
    if (isJumping) {
        playerY += yVelocity;
        yVelocity += GRAVITY;
        
        if (playerY >= GROUND_Y) {
            playerY = GROUND_Y;
            isJumping = false;
            yVelocity = 0;
            
            if (playerState === "jump") {
                if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW)) {
                    playerState = "walk";
                } else {
                    playerState = "idle";
                }
            }
        }
    }
    
    // B. 水平移動
    let moving = false;
    if (keyIsDown(LEFT_ARROW)) {
        playerX -= MOVEMENT_SPEED;
        facingRight = false;
        moving = true;
    } 
    if (keyIsDown(RIGHT_ARROW)) {
        playerX += MOVEMENT_SPEED;
        facingRight = true;
        moving = true;
    }
    
    // C. 狀態轉換 (JUMP 優先級最高)
    if (isJumping) {
        playerState = "jump"; 
        
        if (isShooting) {
            isShooting = false;
            ANIMATION_DATA["shoot"].currentFrame = 0; 
        }
    } else if (isShooting) {
        playerState = "shoot";
    } else {
        if (moving) {
            playerState = "walk"; 
        } else {
            playerState = "idle";
        }
    }
    
    const currentAnimData = ANIMATION_DATA[playerState];
    const halfSpriteW = currentAnimData.frameW * 0.5; 
    playerX = constrain(playerX, halfSpriteW, width - halfSpriteW);


    // D. 動畫幀更新
    const anim = ANIMATION_DATA[playerState];
    if (anim.frames.length > 0) {
        anim.frameCounter++;
        if (anim.frameCounter >= effectiveDelay) {
            anim.frameCounter = 0;
            
            // 循環播放 (Walk, Idle, Run, Stop)
            if (playerState === "walk" || playerState === "idle" || playerState === "run" || playerState === "stop") {
                anim.currentFrame = (anim.currentFrame + 1) % anim.numFrames;
            } 
            // 跳躍單次播放 (跳躍動作的正確邏輯)
            else if (playerState === "jump") {
                if (anim.currentFrame < anim.numFrames - 1) {
                    anim.currentFrame++;
                }
            }
            // 單次播放 (Shoot)
            else if (playerState === "shoot") {
                anim.currentFrame++;
                if (anim.currentFrame >= anim.numFrames) {
                    anim.currentFrame = anim.numFrames - 1; 
                    
                    isShooting = false;
                    
                    if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW)) {
                        playerState = "walk";
                    } else {
                        playerState = "idle";
                    }
                }
            } 
        }
    }

    // 3. 繪製角色 
    if (anim.frames.length > 0) {
        const img = anim.frames[anim.currentFrame || 0];
        const displayW = currentAnimData.frameW;
        const displayH = currentAnimData.frameH;
        
        push();
        translate(playerX, playerY);
        translate(0, -displayH / 2); 

        if (!facingRight) {
            scale(-1, 1);
        }
        
        image(img, 0, 0, displayW, displayH);
        pop();
    } else {
        // 圖像載入/分割失敗時的錯誤提示
        push();
        fill(255, 0, 0);
        textAlign(CENTER);
        textSize(20);
        text(`ERROR: 找不到 [${playerState}] 動畫幀`, playerX, playerY - 50);
        // 顯示當前使用的路徑
        text(`請檢查 [${currentAnimData.path}] 檔案是否正確存在`, playerX, playerY - 20); 
        pop();
    }

    // 顯示提示文字
    push();
    noStroke();
    fill(0, 120);
    textAlign(CENTER, TOP);
    textSize(14);
    text(`角色狀態: ${playerState} | 面向: ${facingRight ? '右' : '左'} | 跳躍中: ${isJumping} | 射擊中: ${isShooting}`, width / 2, 8);
    const currentSpeed = Math.round((BASE_FRAME_DELAY / (typeof effectiveDelay !== 'undefined' ? effectiveDelay : BASE_FRAME_DELAY)) * 100) / 100;
    text(`動畫速度：${currentSpeed}x`, width / 2, 42);
    pop();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    GROUND_Y = height * GROUND_Y_RATIO;
    if (!isJumping) playerY = GROUND_Y;
}

function keyPressed() {
    if (bgm && !bgm.isPlaying()) {
        try { bgm.loop(); } catch (e) { bgm.play(); }
    }
    
    // 跳躍 (UP_ARROW)
    if (keyCode === UP_ARROW) {
        if (!isJumping) {
            isJumping = true;
            yVelocity = JUMP_FORCE;
            
            playerState = "jump";
            ANIMATION_DATA["jump"].currentFrame = 0; 
            
            if (isShooting) {
                isShooting = false;
                ANIMATION_DATA["shoot"].currentFrame = 0;
            }
        }
    } 
    // 射擊 (空格鍵)
    else if (key === ' ' || keyCode === 32) {
        if (!isShooting) {
            isShooting = true;
            ANIMATION_DATA["shoot"].currentFrame = 0; 
        }
    }
}

function keyReleased() {
    if ((keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) && !isJumping && !isShooting) {
        playerState = "idle";
    }
}