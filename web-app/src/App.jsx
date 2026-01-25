import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect, useRef } from 'react';
import './App.css';

// --- CONFIGURATION ---
const GAME_STORE_ID = '0x1fd26dbce4a68bb06c8bf4c8763552a7faa20085622bfecbb036cb7edd40ed53';
const MINING_RATE = {
    'R': { fish: 0.1, meow: 0.0001, label: 'Standard' },
    'SR': { fish: 0.3, meow: 0.001, label: 'High' },
    'SSR': { fish: 1.5, meow: 0.03, label: 'Divine' }
};

// --- DATABASE ---
const CAT_DB = [
    { id: 0, name: 'Gray', rarity: 'R', gender: '♂', personality: 'Lazy', desc: 'Loves sleeping.' },
    { id: 1, name: 'DarkPurple', rarity: 'R', gender: '♀', personality: 'Mysterious', desc: 'Stares at ghosts.' },
    { id: 2, name: 'White', rarity: 'R', gender: '♀', personality: 'Gentle', desc: 'Purrs loudly.' },
    { id: 3, name: 'Orange', rarity: 'R', gender: '♂', personality: 'Chaotic', desc: 'Knocks over cups.' },
    { id: 4, name: 'Light', rarity: 'R', gender: '♀', personality: 'Friendly', desc: 'Greets everyone.' },
    { id: 5, name: 'Black', rarity: 'SR', gender: '♂', personality: 'Cool', desc: 'A ninja cat.' },
    { id: 6, name: 'Tuxedo', rarity: 'SR', gender: '♂', personality: 'Classy', desc: 'Always dressed up.' },
    { id: 7, name: 'ThreeTones', rarity: 'SR', gender: '♀', personality: 'Wild', desc: 'Hunter of bugs.' },
    { id: 8, name: 'Golden', rarity: 'SSR', gender: '✨', personality: 'Divine', desc: 'Brings fortune.' },
    { id: 9, name: 'Pink', rarity: 'SR', gender: '♀', personality: 'Sweet', desc: 'Smells like candy.' },
    { id: 10, name: 'Rainbow', rarity: 'SSR', gender: '🌈', personality: 'Magical', desc: 'Leaves glitter trails.' },
    { id: 11, name: 'Alien', rarity: 'SSR', gender: '👽', personality: 'Weird', desc: 'Beep boop meow.' },
    { id: 12, name: 'Purple', rarity: 'R', gender: '♂', personality: 'Calm', desc: 'Likes lavender.' }
];

const ACC_DB = [
    { id: 100, name: 'Bow', rarity: 'R' }, { id: 101, name: 'Bell', rarity: 'R' },
    { id: 102, name: 'Hat', rarity: 'R' }, { id: 103, name: 'Scarf', rarity: 'R' },
    { id: 104, name: 'Glasses', rarity: 'R' }, { id: 105, name: 'Crown', rarity: 'SR' },
    { id: 106, name: 'Wings', rarity: 'SR' }, { id: 107, name: 'Rainbow', rarity: 'SSR' }
];

const SLOT_SYMBOLS = [
    { id: 0, img: '/assets/slot-symbol1.png', val: 7 }, 
    { id: 1, img: '/assets/slot-symbol2.png', val: 3 }, 
    { id: 2, img: '/assets/slot-symbol3.png', val: 2 }, 
    { id: 3, img: '/assets/slot-symbol4.png', val: 1 }, 
];
const CARD_ICONS = ['🐟', '🦴', '🐭', '🦀', '🧶', '🐱'];

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // --- AUDIO & REFS ---
  const [showSettings, setShowSettings] = useState(false);
  const [musicVol, setMusicVol] = useState(() => parseFloat(localStorage.getItem('musicVol') ?? '0.5'));
  const [sfxVol, setSfxVol] = useState(() => parseFloat(localStorage.getItem('sfxVol') ?? '0.5'));
  const bgmRef = useRef(new Audio('/assets/sounds/bgm_main.mp3'));
  const sfxRef = useRef({});

  // --- GAME STATE ---
  const [localFish, setLocalFish] = useState(() => parseFloat(localStorage.getItem('fish') || '200'));
  const [localMeow, setLocalMeow] = useState(() => parseFloat(localStorage.getItem('meow') || '0'));
  
  const [inventory, setInventory] = useState(() => {
      const saved = JSON.parse(localStorage.getItem('inventory') || '[]');
      if (saved.length === 0) {
          const starter = { ...CAT_DB[0], uuid: Date.now(), type: 'cat', isNew: true, hunger: 100 };
          return [starter];
      }
      return saved;
  });

  const [equippedIds, setEquippedIds] = useState(() => {
      const saved = JSON.parse(localStorage.getItem('equipped') || '[]');
      if (saved.length === 0 && inventory.length > 0) return [inventory[0].uuid];
      return saved;
  });

  const [pityCounter, setPityCounter] = useState(() => parseInt(localStorage.getItem('pity') || '0'));
  const [pendingRewards, setPendingRewards] = useState({ fish: 0, meow: 0 });

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState(null); 
  const [gachaResults, setGachaResults] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [bookDetailCat, setBookDetailCat] = useState(null);
  
  // NEW: FILTER STATE
  const [filterRarity, setFilterRarity] = useState('ALL');

  // --- INTERACTION ---
  const [catPos, setCatPos] = useState({});
  const [catDir, setCatDir] = useState({});
  const [movingCats, setMovingCats] = useState({});
  const [interactingCatId, setInteractingCatId] = useState(null);

  // --- ARCADE STATE ---
  const [gameCount, setGameCount] = useState(() => {
     const today = new Date().toDateString();
     if (localStorage.getItem('lastPlayedDate') !== today) return 0;
     return parseInt(localStorage.getItem('gameCount') || '0');
  });
  const [selectedGame, setSelectedGame] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [gameResultMsg, setGameResultMsg] = useState('');
  // Minigame vars
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedCards, setMatchedCards] = useState([]);
  const [timer, setTimer] = useState(60);
  const [gameState, setGameState] = useState('idle');
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState('heads');
  const [slotReels, setSlotReels] = useState([0, 1, 2]); 
  const [isSpinning, setIsSpinning] = useState(false);
  
  // Daily Login
  const [lastLoginDate, setLastLoginDate] = useState(() => localStorage.getItem('lastLoginDate') || '');
  const [loginStreak, setLoginStreak] = useState(() => parseInt(localStorage.getItem('loginStreak') || '0'));

  // --- SYNC & AUDIO ---
  useEffect(() => { localStorage.setItem('meow', localMeow); }, [localMeow]);
  useEffect(() => { localStorage.setItem('fish', localFish); }, [localFish]);
  useEffect(() => { localStorage.setItem('inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('equipped', JSON.stringify(equippedIds)); }, [equippedIds]);
  useEffect(() => { localStorage.setItem('pity', pityCounter); }, [pityCounter]);
  useEffect(() => { localStorage.setItem('loginStreak', loginStreak); localStorage.setItem('lastLoginDate', lastLoginDate); }, [loginStreak, lastLoginDate]);
  useEffect(() => { localStorage.setItem('gameCount', gameCount); localStorage.setItem('lastPlayedDate', new Date().toDateString()); }, [gameCount]);

  useEffect(() => {
      bgmRef.current.loop = true; bgmRef.current.volume = musicVol;
      bgmRef.current.play().catch(() => {});
      ['ui_click.mp3', 'game_win.mp3', 'slot_spin.mp3', 'cat_meow.mp3', 'cat_eat.mp3'].forEach(n => {
          sfxRef.current[n] = new Audio(`/assets/sounds/${n}`);
      });
  }, []);
  useEffect(() => { bgmRef.current.volume = musicVol; }, [musicVol]);

  const playSfx = (name) => {
      if (bgmRef.current.paused && musicVol > 0) bgmRef.current.play().catch(()=>{});
      if (sfxVol <= 0) return;
      const audio = sfxRef.current[name];
      if (audio) { audio.currentTime = 0; audio.volume = sfxVol; audio.play().catch(()=>{}); }
  };
  const clickSound = () => playSfx('ui_click.mp3');

  // --- CORE LOOPS ---
  useEffect(() => {
    const interval = setInterval(() => {
        setCatPos(prev => {
            const next = { ...prev };
            const nextDir = { ...catDir };
            equippedIds.forEach((id, idx) => {
                if(!next[id]) next[id] = 10 + (idx * 15);
                if (movingCats[id]) {
                    let x = next[id];
                    let dir = nextDir[id] || 'right';
                    if (dir === 'right') { x += 0.5; if (x > 90) dir = 'left'; } 
                    else { x -= 0.5; if (x < 5) dir = 'right'; }
                    next[id] = x; nextDir[id] = dir;
                }
            });
            setCatDir(nextDir);
            return next;
        });
    }, 50);
    return () => clearInterval(interval);
  }, [equippedIds, movingCats, catDir]);

  useEffect(() => {
      const miningTick = setInterval(() => {
          setInventory(prevInv => {
              let earnedFish = 0;
              let earnedMeow = 0;
              const nextInv = prevInv.map(cat => {
                  if (equippedIds.includes(cat.uuid)) {
                      if (cat.hunger > 0) {
                          const rates = MINING_RATE[cat.rarity] || MINING_RATE['R'];
                          earnedFish += rates.fish;
                          if (Math.random() < rates.meow) earnedMeow += 1;
                          return { ...cat, hunger: Math.max(0, cat.hunger - 0.1) };
                      }
                  }
                  return cat;
              });
              if (earnedFish > 0 || earnedMeow > 0) {
                  setPendingRewards(prev => ({ fish: prev.fish + earnedFish, meow: prev.meow + earnedMeow }));
              }
              return nextInv;
          });
      }, 3000); 
      return () => clearInterval(miningTick);
  }, [equippedIds]);

  // --- ACTIONS ---
  const openBlindBox = (times) => {
      clickSound();
      const cost = times * 160;
      if (localFish < cost) return alert("Not enough FISH!");
      setLocalFish(p => p - cost);
      setIsRolling(true); playSfx('slot_spin.mp3'); 

      setTimeout(() => {
          const newItems = [];
          let currentPity = pityCounter;
          for(let i=0; i<times; i++) {
              currentPity++;
              let rarity = 'R';
              let roll = Math.random() * 100;
              if (currentPity >= 60) { rarity = 'SSR'; currentPity = 0; }
              else {
                  if (roll < 1) { rarity = 'SSR'; currentPity = 0; }
                  else if (roll < 6) rarity = 'SR';
              }
              const candidates = CAT_DB.filter(x => x.rarity === rarity);
              const item = candidates[Math.floor(Math.random() * candidates.length)];
              newItems.push({ ...item, uuid: Date.now() + Math.random(), type: 'cat', isNew: true, hunger: 100 });
          }
          setPityCounter(currentPity);
          setInventory([...inventory, ...newItems]);
          setGachaResults(newItems);
          setIsRolling(false);
          const hasRare = newItems.some(i => i.rarity === 'SSR' || i.rarity === 'SR');
          playSfx(hasRare ? 'game_win.mp3' : 'ui_click.mp3');
      }, 2500);
  };

  const handleDailyLogin = () => {
    clickSound();
    const today = new Date().toDateString();
    if (lastLoginDate === today) return alert("Already claimed today!");
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let streak = (lastLoginDate === yesterday) ? loginStreak + 1 : 1;
    const reward = (streak % 7 === 0) ? 300 : 100;
    setLocalFish(f => f + reward);
    setLastLoginDate(today);
    setLoginStreak(streak);
    playSfx('game_win.mp3');
    alert(`Daily Login! Day ${streak}. Received +${reward} FISH!`);
  };

  const buyFish = () => {
    clickSound();
    if (!account) return alert("Connect Wallet first!");
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1000000000)]);
    tx.transferObjects([coin], tx.pure.address(GAME_STORE_ID)); 
    signAndExecute({ transaction: tx }, {
        onSuccess: () => { setLocalFish(p => p + 50); alert("Payment Successful! +50 FISH."); playSfx('game_win.mp3'); },
        onError: () => alert("Transaction Failed!")
    });
  };

  const claimRewards = () => {
    if (pendingRewards.fish <= 0) return;
    clickSound(); playSfx('game_win.mp3');
    setLocalFish(f => f + Math.floor(pendingRewards.fish));
    setLocalMeow(m => m + pendingRewards.meow);
    setPendingRewards({ fish: 0, meow: 0 });
    alert(`Claimed: ${Math.floor(pendingRewards.fish)} FISH & ${pendingRewards.meow} MEOW`);
  };

  const interact = (type, uuid) => {
    if (type === 'wander') {
        clickSound(); setMovingCats(p => ({...p, [uuid]: !p[uuid]})); setInteractingCatId(null); return;
    }
    if (type === 'feed') {
        if (localFish < 5) return alert("Need 5 FISH");
        setLocalFish(p => p - 5); setInventory(prev => prev.map(c => c.uuid === uuid ? { ...c, hunger: Math.min(100, c.hunger + 50) } : c));
        playSfx('cat_eat.mp3'); setInteractingCatId(null); return;
    }
    if (localFish < 1) return alert("Need 1 FISH");
    setLocalFish(p => p - 1); playSfx('cat_meow.mp3'); setInteractingCatId(null);
  };

  // --- MINIGAMES ---
  const checkCanPlay = () => { if (gameCount >= 10) { alert("Daily limit reached (10/10)!"); return false; } return true; };
  const startMemoryGame = () => {
      clickSound(); if(!checkCanPlay()) return;
      const shuffled = [...CARD_ICONS, ...CARD_ICONS].sort(()=>Math.random()-0.5).map((icon,id)=>({id, icon}));
      setCards(shuffled); setFlippedCards([]); setMatchedCards([]); 
      setTimer(60); setGameState('playing'); setGameResultMsg('');
  };
  const handleCardClick = (id) => {
      if (gameState !== 'playing' || flippedCards.length === 2 || matchedCards.includes(id)) return;
      playSfx('ui_click.mp3');
      const newFlipped = [...flippedCards, id];
      setFlippedCards(newFlipped);
      if (newFlipped.length === 2) {
          const [id1, id2] = newFlipped;
          if (cards[id1].icon === cards[id2].icon) {
              setMatchedCards(p => {
                  const newM = [...p, id1, id2];
                  if(newM.length === cards.length) { setGameState('won'); setLocalFish(f=>f+10); setGameCount(c=>c+1); playSfx('game_win.mp3'); }
                  return newM;
              });
              setFlippedCards([]);
          } else { setTimeout(() => setFlippedCards([]), 800); }
      }
  };
  const playCoinFlip = (choice) => {
      clickSound(); if (!checkCanPlay() || isFlipping || localFish < betAmount) return;
      setLocalFish(p => p - betAmount); setIsFlipping(true); setGameResultMsg(''); playSfx('slot_spin.mp3');
      let flips = 0;
      const interval = setInterval(() => {
          setCoinSide(prev => prev === 'heads' ? 'tails' : 'heads'); flips++;
          if (flips > 10) {
              clearInterval(interval);
              const result = Math.random() > 0.5 ? 'heads' : 'tails';
              setCoinSide(result); setIsFlipping(false); setGameCount(c => c + 1);
              if (result === choice) { const win = betAmount * 2; setLocalFish(p => p + win); setGameResultMsg(`WIN! +${win}🐟`); playSfx('game_win.mp3'); } 
              else { setGameResultMsg(`LOST -${betAmount}🐟`); }
          }
      }, 150);
  };
  const playSlotMachine = () => {
      clickSound(); if (!checkCanPlay() || isSpinning || localFish < betAmount) return;
      setLocalFish(p => p - betAmount); setIsSpinning(true); setGameResultMsg(''); playSfx('slot_spin.mp3');
      const interval = setInterval(() => { setSlotReels([Math.floor(Math.random()*4), Math.floor(Math.random()*4), Math.floor(Math.random()*4)]); }, 100);
      setTimeout(() => {
          clearInterval(interval);
          const finalReels = [Math.floor(Math.random()*4), Math.floor(Math.random()*4), Math.floor(Math.random()*4)];
          setSlotReels(finalReels); setIsSpinning(false); setGameCount(c => c + 1);
          const [r1, r2, r3] = finalReels;
          let multiplier = 0;
          if (r1 === r2 && r2 === r3) { multiplier = (SLOT_SYMBOLS[r1].val === 7) ? 10 : 5; } 
          else if (r1 === r2 || r2 === r3 || r1 === r3) { multiplier = 2; }
          if (multiplier > 0) { const win = betAmount * multiplier; setLocalFish(p => p + win); setGameResultMsg(`JACKPOT! x${multiplier} (+${win}🐟)`); playSfx('game_win.mp3'); } 
          else { setGameResultMsg(`LOST -${betAmount}🐟`); }
      }, 2000);
  };

  // --- RENDER HELPERS ---
  const renderBlindBoxShop = () => (
    <div className="gacha-panel">
        <div className="banner-title" style={{color:'#ff7043', fontSize:'20px'}}>BLIND BOX</div>
        <div className="gacha-banner blind-box">
           <div className="blind-box-visual">?</div>
           <div className="banner-info">SSR: 1% | SR: 5% | Pity: {pityCounter}/60</div>
        </div>
        <div className="gacha-actions">
            <div className="btn-roll" onClick={()=>openBlindBox(1)}><span>OPEN 1</span><br/><span>160 🐟</span></div>
            <div className="btn-roll premium" onClick={()=>openBlindBox(10)}><span>OPEN 10</span><br/><span>1600 🐟</span></div>
        </div>
        <div className="sui-top-up">
            <span style={{fontSize:'10px'}}>Need Funds?</span>
            <button className="btn-action" style={{padding:'5px'}} onClick={buyFish}>1 SUI = 50 FISH</button>
        </div>
    </div>
  );

  const renderArcade = () => (
    <div className="pixel-panel arcade-panel">
        <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null); setSelectedGame(null)}}>X</button>
        {!selectedGame ? (
            <>
                <h2 style={{textShadow:'3px 4px 2px #5c69ff', marginTop:'30px', fontSize:'24px'}}>ARCADE CENTER</h2>
                <p style={{fontSize:'14px', color:'yellow'}}>Daily Plays: {gameCount}/10</p>
                <div className="arcade-menu">
                    <button className="game-card-btn" onClick={()=>{startMemoryGame(); setSelectedGame('card');}}>
                        <span style={{fontSize:'30px'}}>🃏</span><span>MEMORY</span>
                    </button>
                    <button className="game-card-btn" onClick={()=>{clickSound(); setSelectedGame('coin')}}>
                        <span style={{fontSize:'30px'}}>📀</span><span>COIN FLIP</span>
                    </button>
                    <button className="game-card-btn" onClick={()=>{clickSound(); setSelectedGame('slot')}}>
                        <span style={{fontSize:'30px'}}>🎰</span><span>SLOTS</span>
                    </button>
                </div>
            </>
        ) : (
             <div className="game-stage">
                <button className="btn-menu" style={{marginBottom:'10px'}} onClick={()=>{clickSound(); setSelectedGame(null); setGameResultMsg('')}}>⬅ BACK</button>
                {selectedGame === 'slot' && (
                    <div className="slot-machine-wrapper">
                        <div className="slot-machine-bg" style={{backgroundImage: 'url(/assets/slot_machine.png)'}}>
                            <div className="reels-window">
                                {slotReels.map((symbolIdx, i) => (
                                    <div key={i} className={`reel ${isSpinning?'blur':''}`}><img src={SLOT_SYMBOLS[symbolIdx].img} alt="s"/></div>
                                ))}
                            </div>
                            <div className={`slot-handle ${isSpinning ? 'pulling' : ''}`}></div>
                        </div>
                        <div className="bet-controls">
                            <input type="number" min="1" max={localFish} value={betAmount} onChange={(e)=>setBetAmount(Number(e.target.value))} />
                            <button className={`btn-spin ${isSpinning?'disabled':''}`} onClick={playSlotMachine}>{isSpinning ? '...' : 'SPIN'}</button>
                        </div>
                    </div>
                )}
                 {selectedGame === 'coin' && (
                    <div className="coin-flip-container">
                        <div className={`coin ${isFlipping ? 'flipping' : ''} ${coinSide}`}>
                            <div className="side heads">HEADS</div>
                            <div className="side tails">TAILS</div>
                        </div>
                        {!isFlipping && <div className="bet-controls">
                            <input type="number" min="1" max={localFish} value={betAmount} onChange={(e)=>setBetAmount(Number(e.target.value))} />
                            <button className="btn-heads" style={{width:'80px'}} onClick={()=>playCoinFlip('heads')}>HEADS</button>
                            <button className="btn-tails" style={{width:'80px'}} onClick={()=>playCoinFlip('tails')}>TAILS</button>
                        </div>}
                    </div>
                )}
                 {selectedGame === 'card' && (
                    <>
                       <div style={{marginBottom:10, fontSize:'16px'}}>⏳ {timer}s | {matchedCards.length/2}/6</div>
                       {gameState === 'won' ? <h3 style={{color:'green', fontSize:'20px'}}>WIN +10🐟</h3> :
                       <div className="card-grid">
                          {cards.map((c,i)=>(<div key={i} className={`card ${flippedCards.includes(i)||matchedCards.includes(i)?'flipped':''}`} onClick={()=>handleCardClick(i)}><div className="card-inner"><div className="card-front">?</div><div className="card-back">{c.icon}</div></div></div>))}
                       </div>}
                    </>
                )}
                <div className="game-msg" style={{fontSize:'16px'}}>{gameResultMsg}</div>
             </div>
        )}
    </div>
  );

  const renderBookDetail = () => (
      <div className="minigame-overlay">
          <div className="book-container detail-view">
                {/* FIXED: Close button inside container */}
              <button className="btn-close" style={{top:'-10px', right:'-10px'}} onClick={()=>{clickSound(); setBookDetailCat(null)}}>X</button>
              
              <div className="book-page left-page">
                  <h3 style={{color: bookDetailCat.rarity==='SSR'?'gold':'#333', fontSize:'20px'}}>{bookDetailCat.name}</h3>
                  <div className="cat-portrait" style={{backgroundImage: `url(/assets/cat_${bookDetailCat.id}.png)`}}></div>
                  <div className="rarity-badge" style={{color: bookDetailCat.rarity==='SSR'?'gold':'#333'}}>{bookDetailCat.rarity} TIER</div>
              </div>
              <div className="book-page right-page">
                  <h3>STATS</h3>
                  <div className="stat-row"><span>GENDER:</span> <span>{bookDetailCat.gender}</span></div>
                  <div className="stat-row"><span>RANK:</span> <span>{bookDetailCat.rarity === 'SSR' ? 'DIVINE' : bookDetailCat.rarity === 'SR' ? 'NOBLE' : 'COMMON'}</span></div>
                  <div className="stat-row"><span>PERSONALITY:</span> <span>{bookDetailCat.personality}</span></div>
                  <div className="stat-row"><span>MINING EFF:</span> <span>{MINING_RATE[bookDetailCat.rarity].label}</span></div>
                  <div className="stat-desc">"{bookDetailCat.desc}"</div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="game-container">
        {/* TOP BAR */}
        <div className="top-bar">
            <div className="group-btn">
                <button className="btn-menu" style={{background:'#d84315'}} onClick={() => {clickSound(); setActiveTab('shop')}}>BLIND BOX</button>
                <button className="btn-menu" style={{background:'#6a1b9a'}} onClick={() => {clickSound(); setActiveTab('arcade')}}>ARCADE</button>
                <button className="btn-menu" style={{background:'#fbc02d', color:'black'}} onClick={() => {clickSound(); setActiveTab('house')}}>HOUSE</button>
                <button className="btn-menu" style={{background:'#1565c0'}} onClick={() => {clickSound(); setActiveTab('book')}}>BOOK</button>
            </div>
            <div className="group-btn">
                <button className="btn-menu setting-btn" onClick={() => {clickSound(); handleDailyLogin()}}>📅</button>
                <button className="btn-menu setting-btn" onClick={() => {clickSound(); setShowSettings(true)}}>⚙️</button>
                <div className="stat-box meow-token">🐱 {localMeow}</div>
                <div className="stat-box fish-token">🐟 {Math.floor(localFish)}</div>
                <div style={{opacity:0.8, transform:'scale(0.8)'}}><ConnectButton /></div>
            </div>
        </div>

        {isRolling && (
            <div className="minigame-overlay" style={{zIndex: 4000}}>
                <div className="rolling-container">
                    <div className="rolling-box shake-anim">?</div>
                    <div className="rolling-text">OPENING...</div>
                </div>
            </div>
        )}

        {showSettings && (
             <div className="minigame-overlay">
             <div className="pixel-panel settings-panel">
                 <h3>SETTINGS</h3>
                 <div className="setting-row"><label>MUSIC</label><input type="range" max="1" step="0.1" value={musicVol} onChange={(e)=>setMusicVol(parseFloat(e.target.value))} /></div>
                 <div className="setting-row"><label>SFX</label><input type="range" max="1" step="0.1" value={sfxVol} onChange={(e)=>setSfxVol(parseFloat(e.target.value))} /></div>
                 <button className="btn-action" onClick={()=>{clickSound(); setShowSettings(false)}}>CLOSE</button>
             </div></div>
        )}

        {activeTab === 'shop' && (
            <div className="minigame-overlay">
                <div className="pixel-panel">
                    <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null); setGachaResults(null)}}>X</button>
                    {gachaResults ? (
                        <div className="gacha-panel">
                            <h2 style={{color:'gold', fontSize:'30px'}}>RESULTS</h2>
                            <div className="result-grid">{gachaResults.map((item, i) => (<div key={i} className={`result-item ${item.rarity}`}><div className="item-img" style={{backgroundImage: `url(/assets/cat_${item.id}.png)`}}></div><span>{item.rarity}</span></div>))}</div>
                            <button className="btn-action" onClick={()=>{clickSound(); setGachaResults(null)}}>COLLECT</button>
                        </div>
                    ) : renderBlindBoxShop()}
                </div>
            </div>
        )}

        {/* HOUSE WITH FILTER */}
        {activeTab === 'house' && (
            <div className="minigame-overlay">
                <div className="pixel-panel" style={{width:'800px'}}>
                    <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null)}}>X</button>
                    <h2>MY HOUSE</h2>
                    
                    {/* NEW: FILTER BAR */}
                    <div className="filter-bar">
                        <button className={filterRarity==='ALL'?'active':''} onClick={()=>setFilterRarity('ALL')}>ALL</button>
                        <button className={filterRarity==='R'?'active':''} onClick={()=>setFilterRarity('R')}>R</button>
                        <button className={filterRarity==='SR'?'active':''} onClick={()=>setFilterRarity('SR')}>SR</button>
                        <button className={filterRarity==='SSR'?'active':''} onClick={()=>setFilterRarity('SSR')}>SSR</button>
                    </div>

                    <div className="house-grid">
                        {inventory
                            .filter(i => i.type === 'cat')
                            .filter(i => filterRarity === 'ALL' || i.rarity === filterRarity) // Logic Filter
                            .map(cat => (
                            <div key={cat.uuid} className={`house-slot ${equippedIds.includes(cat.uuid) ? 'active' : ''}`} 
                                 onClick={() => {clickSound(); if(equippedIds.includes(cat.uuid)) setEquippedIds(p=>p.filter(id=>id!==cat.uuid)); else { if(equippedIds.length>=6) return alert("Max 6 cats"); setEquippedIds(p=>[...p, cat.uuid]); }}}>
                                <div className="pixel-icon" style={{backgroundImage: `url(/assets/cat_${cat.id}.png)`}}></div>
                                <div className="hunger-bar"><div style={{width:`${cat.hunger}%`, background: cat.hunger<20?'red':'#00e676'}}></div></div>
                                {equippedIds.includes(cat.uuid) && <div className="equipped-badge">E</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'arcade' && (
            <div className="minigame-overlay">{renderArcade()}</div>
        )}

        {activeTab === 'book' && (
            <div className="minigame-overlay">
                <div className="book-container">
                    {/* FIXED: Close button inside container */}
                    <button className="btn-close" style={{top:'-10px', right:'-10px'}} onClick={()=>{clickSound(); setActiveTab(null)}}>X</button>
                    <div className="book-page">
                        <h3>CATS</h3>
                        <div className="book-grid">{CAT_DB.map(c => { 
                            const isOwned = inventory.some(i => i.id === c.id); 
                            return (
                                <div key={c.id} className={`book-item ${!isOwned ? 'locked' : ''}`} 
                                     onClick={()=>{if(isOwned) {clickSound(); setBookDetailCat(c)}}}>
                                    {isOwned ? <div className="pixel-icon" style={{backgroundImage: `url(/assets/cat_${c.id}.png)`}}></div> : '?'}
                                </div>
                            ) 
                        })}</div>
                    </div>
                    <div className="book-page">
                        <h3>GEAR</h3>
                        <div className="book-grid">{ACC_DB.map(a => (<div key={a.id} className="book-item locked">?</div>))}</div>
                    </div>
                </div>
            </div>
        )}

        {bookDetailCat && renderBookDetail()}

        {(pendingRewards.fish > 0.1 || pendingRewards.meow > 0) && (
            <div className="claim-box" onClick={claimRewards}>
                <div className="claim-title">REWARDS</div>
                <div>🐟 {pendingRewards.fish.toFixed(1)}</div>
                {pendingRewards.meow > 0 && <div>🐱 {pendingRewards.meow}</div>}
                <div className="claim-anim">CLAIM</div>
            </div>
        )}

        {inventory.filter(item => equippedIds.includes(item.uuid)).map((cat) => {
             const moving = movingCats[cat.uuid];
             const isHungry = cat.hunger <= 0;
             return (
             <div key={cat.uuid} className="cat-wrapper" style={{ left: `${catPos[cat.uuid]}%`, bottom: '-50%', top:'90%' }}>
                {isHungry && <div className="bubble-hungry">🍖</div>}
                {interactingCatId === cat.uuid && (
                    <div className="cat-think-panel">
                        <div style={{fontSize:'12px', textAlign:'center', color:'black', marginBottom:'5px', fontWeight:'bold'}}>Hunger: {Math.round(cat.hunger)}</div>
                        <button onClick={()=>interact('feed', cat.uuid)}>Feed 5🐟</button>
                        <button onClick={()=>interact('pet', cat.uuid)}>Pet</button>
                        <button onClick={()=>interact('wander', cat.uuid)}>{moving ? 'Stop' : 'Wander'}</button>
                        <button style={{background:'#c62828'}} onClick={()=>{clickSound(); setInteractingCatId(null)}}>X</button>
                    </div>
                )}
                <div className={`cat-aura ${cat.rarity === 'SR' ? 'cat-sr' : ''} ${cat.rarity === 'SSR' ? 'cat-ssr' : ''}`}> 
                    <div className={`Character ${moving ? 'is-moving' : 'is-idle'} ${(catDir[cat.uuid]||'right')==='right'?'face-right':'face-left'} `} 
                         style={{filter: isHungry ? 'grayscale(1)' : 'none'}}
                         onClick={() => {clickSound(); setInteractingCatId(interactingCatId === cat.uuid ? null : cat.uuid)}}>
                        <img src={`/assets/cat_${cat.id}.png`} className="Character_spritesheet" alt="cat" />
                    </div>
                </div>
                {!isHungry && <div className="mining-sparkle">✨</div>}
             </div>
        )})}
    </div>
  );
}

export default App;