import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect, useRef } from 'react';
import './App.css';

// --- CONFIGURATION ---
const GAME_STORE_ID = '0xc3252f40a3e03fd975ac66bd685125188490ab3c6f82b8c547e2f9b6e1abec0e';

// --- DATABASE ---
const CAT_DB = [
    { id: 0, name: 'Orange', rarity: 'R', origin: 'Backyard', personality: 'Lazy' },
    { id: 1, name: 'Black', rarity: 'R', origin: 'Witch House', personality: 'Mysterious' },
    { id: 2, name: 'White', rarity: 'R', origin: 'Hospital', personality: 'Gentle' },
    { id: 3, name: 'Grey', rarity: 'R', origin: 'City', personality: 'Active' },
    { id: 4, name: 'Tuxedo', rarity: 'R', origin: 'Mansion', personality: 'Elegant' },
    { id: 5, name: 'Siamese', rarity: 'SR', origin: 'Thailand', personality: 'Chatty' },
    { id: 6, name: 'Calico', rarity: 'SR', origin: 'Farm', personality: 'Lucky' },
    { id: 7, name: 'Bengal', rarity: 'SR', origin: 'Jungle', personality: 'Wild' },
    { id: 8, name: 'Golden', rarity: 'SSR', origin: 'Heaven', personality: 'Divine' }
];
const ACC_DB = [
    { id: 100, name: 'Bow', rarity: 'R' }, { id: 101, name: 'Bell', rarity: 'R' },
    { id: 102, name: 'Hat', rarity: 'R' }, { id: 103, name: 'Scarf', rarity: 'R' },
    { id: 104, name: 'Glasses', rarity: 'R' }, { id: 105, name: 'Crown', rarity: 'SR' },
    { id: 106, name: 'Wings', rarity: 'SR' }, { id: 107, name: 'Rainbow', rarity: 'SSR' }
];
const CARD_ICONS = ['🐟', '🦴', '🐭', '🦀', '🧶', '🐱'];
const SLOT_SYMBOLS = [
    { id: 0, img: '/assets/slot-symbol1.png', val: 7 }, // 777
    { id: 1, img: '/assets/slot-symbol2.png', val: 3 }, // Cherry
    { id: 2, img: '/assets/slot-symbol3.png', val: 2 }, // Bell
    { id: 3, img: '/assets/slot-symbol4.png', val: 1 }, // Bar
];

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // --- AUDIO STATE & REFS ---
  const [showSettings, setShowSettings] = useState(false);
  const [musicVol, setMusicVol] = useState(() => parseFloat(localStorage.getItem('musicVol') ?? '0.5'));
  const [sfxVol, setSfxVol] = useState(() => parseFloat(localStorage.getItem('sfxVol') ?? '0.5'));
  const bgmRef = useRef(new Audio('/assets/sounds/bgm_main.mp3'));

  // --- GAME STATE ---
  const [localFish, setLocalFish] = useState(() => parseInt(localStorage.getItem('fish') || '200'));
  
  const [inventory, setInventory] = useState(() => {
      const saved = JSON.parse(localStorage.getItem('inventory') || '[]');
      if (saved.length === 0) {
          const starter = { ...CAT_DB[0], uuid: Date.now(), type: 'cat', isNew: true, name: 'Starter Meow' };
          return [starter];
      }
      return saved;
  });

  const [equippedIds, setEquippedIds] = useState(() => {
      const saved = JSON.parse(localStorage.getItem('equipped') || '[]');
      if (saved.length === 0) {
        const inv = JSON.parse(localStorage.getItem('inventory') || '[]');
        if (inv.length > 0) return [inv[0].uuid];
      }
      return saved;
  });

  const [pityCounter, setPityCounter] = useState(() => parseInt(localStorage.getItem('pity') || '0'));
  
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState(null); 
  const [gachaTab, setGachaTab] = useState('cat'); 
  const [gachaResults, setGachaResults] = useState(null);
  const [viewingCat, setViewingCat] = useState(null);

  // --- INTERACTION ---
  const [catPos, setCatPos] = useState({});
  const [catDir, setCatDir] = useState({});
  const [movingCats, setMovingCats] = useState({});
  const [interactingCatId, setInteractingCatId] = useState(null);

  // --- ARCADE STATE ---
  const [lastPlayedDate, setLastPlayedDate] = useState(() => localStorage.getItem('lastPlayedDate') || '');
  const [gameCount, setGameCount] = useState(() => {
     const today = new Date().toDateString();
     const savedDate = localStorage.getItem('lastPlayedDate');
     if (savedDate !== today) return 0;
     return parseInt(localStorage.getItem('gameCount') || '0');
  });
  
  const [selectedGame, setSelectedGame] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [gameResultMsg, setGameResultMsg] = useState('');

  // Minigame Variables
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedCards, setMatchedCards] = useState([]);
  const [timer, setTimer] = useState(60);
  const [gameState, setGameState] = useState('idle');

  const [isFlipping, setIsFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState('heads');

  const [slotReels, setSlotReels] = useState([0, 1, 2]); 
  const [isSpinning, setIsSpinning] = useState(false);
  const [handleFrame, setHandleFrame] = useState(1);

  // --- AUDIO LOGIC ---
  useEffect(() => {
      bgmRef.current.loop = true;
      bgmRef.current.volume = musicVol;
      // Thử phát nhạc, nếu trình duyệt chặn thì chờ user click
      bgmRef.current.play().catch(() => {});
      localStorage.setItem('musicVol', musicVol);
  }, [musicVol]);

  useEffect(() => { localStorage.setItem('sfxVol', sfxVol); }, [sfxVol]);

  const playSfx = (filename) => {
      if (sfxVol <= 0) return;
      const audio = new Audio(`/assets/sounds/${filename}`);
      audio.volume = sfxVol;
      audio.play().catch(() => {});
  };

  // Wrapper cho các nút bấm (Sound + Logic + Start BGM if needed)
  const clickSound = () => {
      playSfx('ui_click.mp3');
      if (bgmRef.current.paused && musicVol > 0) bgmRef.current.play().catch(()=>{});
  };

  // --- SYNC ---
  useEffect(() => { localStorage.setItem('fish', localFish); }, [localFish]);
  useEffect(() => { localStorage.setItem('inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('equipped', JSON.stringify(equippedIds)); }, [equippedIds]);
  useEffect(() => { localStorage.setItem('pity', pityCounter); }, [pityCounter]);
  useEffect(() => {
      localStorage.setItem('gameCount', gameCount);
      const today = new Date().toDateString();
      localStorage.setItem('lastPlayedDate', today);
  }, [gameCount]);

  useEffect(() => {
      const newPos = {};
      equippedIds.forEach((uuid, index) => {
          if(!catPos[uuid]) newPos[uuid] = 10 + (index * 15); 
          else newPos[uuid] = catPos[uuid];
      });
      setCatPos(prev => ({...prev, ...newPos}));
  }, [equippedIds]);

  useEffect(() => {
    const interval = setInterval(() => {
        setCatPos(prev => {
            const next = { ...prev };
            const nextDir = { ...catDir };
            Object.keys(movingCats).forEach(id => {
                if (movingCats[id]) {
                    let x = next[id] || 50;
                    let dir = nextDir[id] || 'right';
                    if (dir === 'right') { x += 0.5; if (x > 90) dir = 'left'; } 
                    else { x -= 0.5; if (x < 5) dir = 'right'; }
                    next[id] = x;
                    nextDir[id] = dir;
                }
            });
            setCatDir(nextDir);
            return next;
        });
    }, 50);
    return () => clearInterval(interval);
  }, [movingCats, catDir]);

  // --- ACTIONS ---
  const rollGacha = (times) => {
      clickSound();
      const cost = times === 10 ? 160 : 16;
      if (localFish < cost) return alert("Not enough fish!");
      setLocalFish(p => p - cost);

      const pool = gachaTab === 'cat' ? CAT_DB : ACC_DB;
      const newItems = [];
      let currentPity = pityCounter;

      for(let i=0; i<times; i++) {
          currentPity++;
          let rarity = 'R';
          let roll = Math.random() * 100;
          if (currentPity >= 60) { rarity = 'SSR'; currentPity = 0; }
          else if (times === 10 && i === 9) { rarity = 'SR'; }
          else {
              if (roll < 5) { rarity = 'SSR'; currentPity = 0; }
              else if (roll < 30) rarity = 'SR';
          }
          const candidates = pool.filter(x => x.rarity === rarity);
          const item = candidates[Math.floor(Math.random() * candidates.length)];
          newItems.push({ ...item, uuid: Date.now() + Math.random(), type: gachaTab, isNew: true });
      }
      setPityCounter(currentPity);
      setInventory([...inventory, ...newItems]);
      setGachaResults(newItems);
      playSfx('game_win.mp3'); // Sound Win
  };

  const buyFish = () => {
      clickSound();
      if (!account) return alert("Connect Wallet first!");
      const tx = new Transaction();
      const amountInMist = 1000000000; 
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);
      tx.transferObjects([coin], tx.pure.address(GAME_STORE_ID)); 
      signAndExecute({ transaction: tx }, {
          onSuccess: () => { 
              setLocalFish(p => p + 100); 
              alert("Payment Successful! +100 Fish."); 
              playSfx('game_win.mp3');
          },
          onError: () => alert("Transaction Failed!")
      });
  };

  const toggleEquip = (uuid) => {
      clickSound();
      if (equippedIds.includes(uuid)) {
          setEquippedIds(p => p.filter(id => id !== uuid));
      } else {
          if (equippedIds.length >= 6) return alert("Max 6 cats on screen!");
          setEquippedIds(p => [...p, uuid]);
      }
  };

  const interact = (type, uuid) => {
      if (type === 'wander') {
          clickSound();
          setMovingCats(p => ({...p, [uuid]: !p[uuid]}));
          setInteractingCatId(null);
          return;
      }
      if (localFish < 1) return alert("Not enough fish!");
      setLocalFish(p => p - 1);
      
      // Specific Sounds
      if (type === 'feed') playSfx('cat_eat.mp3');
      else if (type === 'pet') playSfx('cat_meow.mp3');
      else clickSound();

      alert(`${type} successful!`);
      setInteractingCatId(null);
  };

  const handleNextPrevCat = (direction) => {
      clickSound();
      if (!viewingCat) return;
      const myCats = inventory.filter(i => i.type === 'cat');
      const currentIndex = myCats.findIndex(c => c.uuid === viewingCat.uuid);
      let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex >= myCats.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = myCats.length - 1;
      setViewingCat(myCats[nextIndex]);
  };

  // --- ARCADE LOGIC ---
  const checkCanPlay = () => {
      const today = new Date().toDateString();
      if (lastPlayedDate !== today) {
          setGameCount(0);
          setLastPlayedDate(today);
          return true;
      }
      if (gameCount >= 10) {
          alert("Daily limit reached (10/10)! Come back tomorrow.");
          return false;
      }
      return true;
  };

  const startMemoryGame = () => {
      clickSound();
      if(!checkCanPlay()) return;
      const shuffled = [...CARD_ICONS, ...CARD_ICONS].sort(()=>Math.random()-0.5).map((icon,id)=>({id, icon}));
      setCards(shuffled); setFlippedCards([]); setMatchedCards([]); 
      setTimer(60); setGameState('playing'); setGameResultMsg('');
  };
  const handleCardClick = (id) => {
      if (gameState !== 'playing' || flippedCards.length === 2 || matchedCards.includes(id)) return;
      
      playSfx('ui_click.mp3'); // Sound Card Flip

      const newFlipped = [...flippedCards, id];
      setFlippedCards(newFlipped);
      if (newFlipped.length === 2) {
          const [id1, id2] = newFlipped;
          if (cards[id1].icon === cards[id2].icon) {
              setMatchedCards(p => {
                  const newM = [...p, id1, id2];
                  if(newM.length === cards.length) { 
                      setGameState('won'); setLocalFish(f=>f+5); setGameCount(c=>c+1); 
                      playSfx('game_win.mp3');
                  }
                  return newM;
              });
              setFlippedCards([]);
          } else { setTimeout(() => setFlippedCards([]), 800); }
      }
  };
  useEffect(() => {
      let interval;
      if (selectedGame === 'card' && gameState === 'playing') {
          interval = setInterval(() => {
              setTimer(t => { if (t <= 1) { setGameState('lost'); return 0; } return t - 1; });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [selectedGame, gameState]);

  const playCoinFlip = (choice) => {
      clickSound();
      if (!checkCanPlay()) return;
      if (localFish < betAmount) return alert("Not enough fish!");
      if (isFlipping) return;

      setLocalFish(p => p - betAmount);
      setIsFlipping(true); setGameResultMsg('');
      playSfx('slot_spin.mp3'); // Sound Spinning

      let flips = 0;
      const interval = setInterval(() => {
          setCoinSide(prev => prev === 'heads' ? 'tails' : 'heads');
          flips++;
          if (flips > 10) {
              clearInterval(interval);
              const result = Math.random() > 0.5 ? 'heads' : 'tails';
              setCoinSide(result); setIsFlipping(false); setGameCount(c => c + 1);
              
              if (result === choice) {
                  const win = betAmount * 2;
                  setLocalFish(p => p + win);
                  setGameResultMsg(`WIN! +${win}🐟`);
                  playSfx('game_win.mp3');
              } else {
                  setGameResultMsg(`LOST -${betAmount}🐟`);
              }
          }
      }, 150);
  };

  const playSlotMachine = () => {
      clickSound();
      if (!checkCanPlay()) return;
      if (localFish < betAmount) return alert("Not enough fish!");
      if (isSpinning) return;

      setLocalFish(p => p - betAmount);
      setIsSpinning(true); setGameResultMsg('');
      playSfx('slot_spin.mp3'); // Sound Spinning

      let frame = 1;
      const handleInt = setInterval(() => {
          frame++; setHandleFrame(frame);
          if(frame >= 5) { clearInterval(handleInt); setTimeout(()=>setHandleFrame(1), 200); }
      }, 80);

      const interval = setInterval(() => {
          setSlotReels([Math.floor(Math.random()*4), Math.floor(Math.random()*4), Math.floor(Math.random()*4)]);
      }, 100);

      setTimeout(() => {
          clearInterval(interval);
          const finalReels = [Math.floor(Math.random()*4), Math.floor(Math.random()*4), Math.floor(Math.random()*4)];
          setSlotReels(finalReels); setIsSpinning(false); setGameCount(c => c + 1);

          const [r1, r2, r3] = finalReels;
          let multiplier = 0;
          if (r1 === r2 && r2 === r3) {
              if (SLOT_SYMBOLS[r1].val === 7) multiplier = 10; else multiplier = 5; 
          } else if (r1 === r2 || r2 === r3 || r1 === r3) { multiplier = 2; }

          if (multiplier > 0) {
              const win = betAmount * multiplier;
              setLocalFish(p => p + win);
              setGameResultMsg(`JACKPOT! x${multiplier} (+${win}🐟)`);
              playSfx('game_win.mp3');
          } else {
              setGameResultMsg(`LOST -${betAmount}🐟`);
          }
      }, 2000);
  };

  // --- RENDER FUNCTIONS (FULL RESTORATION) ---

  const renderSettings = () => (
      <div className="minigame-overlay">
          <div className="pixel-panel settings-panel">
              <h3>SETTINGS</h3>
              <div className="setting-row">
                  <label>MUSIC: {Math.round(musicVol * 100)}%</label>
                  <input type="range" min="0" max="1" step="0.1" value={musicVol} onChange={(e)=>setMusicVol(parseFloat(e.target.value))} />
              </div>
              <div className="setting-row">
                  <label>SFX: {Math.round(sfxVol * 100)}%</label>
                  <input type="range" min="0" max="1" step="0.1" value={sfxVol} onChange={(e)=>setSfxVol(parseFloat(e.target.value))} />
              </div>
              <button className="btn-action" onClick={()=>{clickSound(); setShowSettings(false)}}>CLOSE</button>
          </div>
      </div>
  );

  const renderShopMain = () => (
      <div className="gacha-panel">
          <div className="gacha-tabs">
              <button className={`tab-btn ${gachaTab==='cat'?'active':''}`} onClick={()=>{clickSound(); setGachaTab('cat')}}>BATTLE CATS</button>
              <button className={`tab-btn ${gachaTab==='acc'?'active':''}`} onClick={()=>{clickSound(); setGachaTab('acc')}}>ACCESSORIES</button>
          </div>
          <div className={`gacha-banner ${gachaTab}`}>
              <div className="banner-title">{gachaTab==='cat' ? 'DIVINE CATS' : 'FASHION'}</div>
              <div className="banner-info">SSR: 5% | Pity: {pityCounter}/60</div>
          </div>
          <div className="gacha-actions">
              <div className="btn-roll" onClick={()=>rollGacha(1)}><span>ROLL 1</span><span>16🐟</span></div>
              <div className="btn-roll premium" onClick={()=>rollGacha(10)}>
                  <div className="guarantee-tag">SR GUARANTEE</div><span>ROLL 10</span><span>160🐟</span>
              </div>
          </div>
          <div className="sui-top-up">
              <span style={{fontSize:'8px'}}>Need Fish?</span>
              <button className="btn-action" style={{margin:0, width:'auto'}} onClick={buyFish}>1 SUI = 100 FISH</button>
          </div>
      </div>
  );

  const renderGachaResult = () => (
      <div className="gacha-panel">
          <h2 style={{color:'gold'}}>RESULTS</h2>
          <div className="result-grid">
              {gachaResults.map((item, idx) => (
                  <div key={idx} className={`result-item ${item.rarity}`}>
                      <div className="item-img" style={{
                          backgroundImage: item.type === 'cat' ? `url(/assets/cat_${item.id}.png)` : 'none',
                      }}> {item.type === 'acc' && '🎁'} </div>
                      <span className="item-name" style={{color: item.rarity==='SSR'?'gold':item.rarity==='SR'?'cyan':'black'}}>{item.name}</span>
                  </div>
              ))}
          </div>
          <button className="btn-action" onClick={()=>{clickSound(); setGachaResults(null)}}>COLLECT</button>
      </div>
  );

  const renderCatDetail = () => {
      const isEquipped = equippedIds.includes(viewingCat.uuid);
      return (
        <div className="minigame-overlay">
            <div className="book-container detail-view">
                <div className="book-page">
                    <h3>{viewingCat.name.toUpperCase()}</h3>
                    <div className="cat-portrait" style={{backgroundImage: `url(/assets/cat_${viewingCat.id}.png)`}}></div>
                    <div className="rarity-badge" style={{color: viewingCat.rarity === 'SSR' ? 'gold' : viewingCat.rarity === 'SR' ? 'cyan' : '#333'}}>
                        {viewingCat.rarity} TIER
                    </div>
                </div>
                <div className="book-page info-page">
                    <h3>INFO</h3>
                    <div className="info-row"><span>BREED:</span> <span>{viewingCat.name}</span></div>
                    <div className="info-row"><span>ORIGIN:</span> <span>{viewingCat.origin}</span></div>
                    <div className="info-row"><span>PERSONALITY:</span> <span>{viewingCat.personality}</span></div>
                    <div className="info-row"><span>HUNGER:</span> <span>50/100</span></div>
                    
                    <div className="action-row">
                        <button className="btn-nav" onClick={()=>handleNextPrevCat('prev')}>◀</button>
                        <button 
                            className={`btn-equip ${isEquipped ? 'unequip' : ''}`}
                            onClick={()=>toggleEquip(viewingCat.uuid)}
                        >
                            {isEquipped ? 'RETURN TO HOUSE' : 'SEND TO SCREEN'}
                        </button>
                        <button className="btn-nav" onClick={()=>handleNextPrevCat('next')}>▶</button>
                    </div>
                    <button className="btn-close-detail" onClick={()=>{clickSound(); setViewingCat(null)}}>EXIT</button>
                </div>
            </div>
        </div>
      )
  };

  const renderArcade = () => (
      <div className="minigame-overlay">
          <div className="pixel-panel arcade-panel">
              <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null); setSelectedGame(null)}}>X</button>
              
              {!selectedGame ? (
                  <>
                      <h2>ARCADE CENTER</h2>
                      <p style={{fontSize:'10px', color:'cyan'}}>Daily Limit: {gameCount}/10 plays</p>
                      <div className="arcade-menu">
                          <button className="game-card-btn" onClick={()=>{startMemoryGame(); setSelectedGame('card');}}>
                              <span style={{fontSize:'20px'}}>🃏</span><br/>MEMORY<br/>(Win 5🐟)
                          </button>
                          <button className="game-card-btn" onClick={()=>{clickSound(); setSelectedGame('coin')}}>
                              <span style={{fontSize:'20px'}}>🪙</span><br/>COIN FLIP<br/>(x2 Bet)
                          </button>
                          <button className="game-card-btn" onClick={()=>{clickSound(); setSelectedGame('slot')}}>
                              <span style={{fontSize:'20px'}}>🎰</span><br/>SLOTS<br/>(Max x10)
                          </button>
                      </div>
                  </>
              ) : (
                  <div className="game-stage">
                      <div className="game-header">
                          <button className="btn-menu" onClick={()=>{clickSound(); setSelectedGame(null); setGameResultMsg('')}}>⬅ BACK</button>
                          <span>Uses: {gameCount}/10</span>
                      </div>

                      {/* SLOT MACHINE UI */}
                      {selectedGame === 'slot' && (
                          <div className="slot-machine-container">
                              <div className="slot-bg" style={{backgroundImage: `url(/assets/slot-machine${handleFrame}.png)`}}>
                                  <div className="reels-window">
                                      {slotReels.map((symbolIdx, i) => (
                                          <div key={i} className={`reel ${isSpinning?'blur':''}`}>
                                              <img src={SLOT_SYMBOLS[symbolIdx].img} alt="symbol"/>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                              <div className="bet-controls">
                                  <label>BET:</label>
                                  <input type="number" min="1" max={localFish} value={betAmount} onChange={(e)=>setBetAmount(Number(e.target.value))} />
                                  <button className={`btn-spin ${isSpinning?'disabled':''}`} onClick={playSlotMachine}>
                                      {isSpinning ? 'SPINNING...' : 'SPIN'}
                                  </button>
                              </div>
                              <div className="game-msg">{gameResultMsg}</div>
                          </div>
                      )}

                      {/* COIN FLIP UI */}
                      {selectedGame === 'coin' && (
                          <div className="coin-flip-container">
                              <div className={`coin ${isFlipping ? 'flipping' : ''} ${coinSide}`}>
                                  <div className="side heads"></div>
                                  <div className="side tails"></div>
                              </div>
                              
                              {!isFlipping && (
                                  <div className="bet-controls vertical">
                                      <input type="number" min="1" max={localFish} value={betAmount} onChange={(e)=>setBetAmount(Number(e.target.value))} placeholder="Bet Amount" />
                                      <div style={{display:'flex', gap:'10px'}}>
                                          <button className="btn-action" onClick={()=>playCoinFlip('heads')}>HEADS</button>
                                          <button className="btn-action" style={{background:'#d81b60'}} onClick={()=>playCoinFlip('tails')}>TAILS</button>
                                      </div>
                                  </div>
                              )}
                              <div className="game-msg">{gameResultMsg}</div>
                          </div>
                      )}

                      {/* MEMORY UI */}
                      {selectedGame === 'card' && (
                          <>
                             <div style={{display:'flex', justifyContent:'space-between', marginBottom:10, width:'300px'}}>
                                <span>⏳ {timer}s</span><span>{matchedCards.length/2}/6</span>
                             </div>
                             {gameState === 'lost' ? <h3 style={{color:'red'}}>GAME OVER!</h3> :
                             gameState === 'won' ? <h3 style={{color:'green'}}>WIN +5🐟</h3> :
                             <div className="card-grid">
                                {cards.map((c,i)=>(<div key={i} className={`card ${flippedCards.includes(i)||matchedCards.includes(i)?'flipped':''}`} onClick={()=>handleCardClick(i)}><div className="card-inner"><div className="card-front">?</div><div className="card-back">{c.icon}</div></div></div>))}
                             </div>}
                             <div className="game-msg">{gameResultMsg}</div>
                          </>
                      )}
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className="game-container">
        <div className="top-bar">
            <div className="group-btn">
                <button className="btn-menu" style={{background:'#2e7d32'}} onClick={() => {clickSound(); setActiveTab('shop')}}>SHOP</button>
                <button className="btn-menu" style={{background:'#d81b60'}} onClick={() => {clickSound(); setActiveTab('arcade')}}>ARCADE</button>
                <button className="btn-menu" style={{background:'#fbc02d', color:'black'}} onClick={() => {clickSound(); setActiveTab('house')}}>CAT HOUSE</button>
                <button className="btn-menu" style={{background:'#1565c0'}} onClick={() => {clickSound(); setActiveTab('book')}}>BOOK</button>
            </div>
            <div className="group-btn">
                <button className="btn-menu setting-btn" onClick={() => {clickSound(); setShowSettings(true)}}>⚙️</button>
                <div className="stat-box">🐟 {localFish}</div>
                <div style={{opacity:0.8, transform:'scale(0.8)'}}><ConnectButton /></div>
            </div>
        </div>

        {/* SETTINGS POPUP */}
        {showSettings && renderSettings()}

        {/* SHOP */}
        {activeTab === 'shop' && (
            <div className="minigame-overlay">
                <div className="pixel-panel">
                    <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null); setGachaResults(null)}}>X</button>
                    {gachaResults ? renderGachaResult() : renderShopMain()}
                </div>
            </div>
        )}

        {/* HOUSE */}
        {activeTab === 'house' && (
            <div className="minigame-overlay">
                <div className="pixel-panel">
                    <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null)}}>X</button>
                    <h2>MY CAT HOUSE</h2>
                    <div className="house-grid">
                        {inventory.filter(i => i.type === 'cat').map(cat => (
                            <div key={cat.uuid} className={`house-slot ${equippedIds.includes(cat.uuid) ? 'active' : ''}`} onClick={() => {clickSound(); setViewingCat(cat)}}>
                                <div className="pixel-icon" style={{backgroundImage: `url(/assets/cat_${cat.id}.png)`}}></div>
                                <span style={{fontSize:'8px', color: cat.rarity === 'SSR' ? 'gold' : 'white'}}>{cat.rarity}</span>
                                {equippedIds.includes(cat.uuid) && <div className="equipped-badge">E</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {viewingCat && renderCatDetail()}

        {/* BOOK */}
        {activeTab === 'book' && (
            <div className="minigame-overlay">
                <div className="book-container">
                    <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null)}}>X</button>
                    <div className="book-page">
                        <h3>CATS</h3>
                        <div className="book-grid">
                            {CAT_DB.map(c => {
                                const isOwned = inventory.some(i => i.id === c.id && i.type === 'cat');
                                return (<div key={c.id} className={`book-item ${!isOwned ? 'locked' : ''}`}>{isOwned ? <div className="pixel-icon" style={{backgroundImage: `url(/assets/cat_${c.id}.png)`}}></div> : '?'}</div>)
                            })}
                        </div>
                    </div>
                    <div className="book-page">
                        <h3>GEAR</h3>
                        <div className="book-grid">
                            {ACC_DB.map(a => (<div key={a.id} className={`book-item ${!inventory.some(i => i.id === a.id) ? 'locked' : ''}`}>{inventory.some(i => i.id === a.id) ? '🎁' : '?'}</div>))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ARCADE */}
        {activeTab === 'arcade' && renderArcade()}

        {/* CATS ON SCREEN */}
        {inventory.filter(item => equippedIds.includes(item.uuid)).map((cat) => {
             const moving = movingCats[cat.uuid];
             const dir = catDir[cat.uuid] || 'right';
             return (
             <div key={cat.uuid} className="cat-wrapper" style={{ left: `${catPos[cat.uuid]}%`, bottom: '25%' }}>
                {interactingCatId === cat.uuid && (
                    <div className="cat-think-panel">
                        <button onClick={()=>interact('feed', cat.uuid)}>Feed (1🐟)</button>
                        <button onClick={()=>interact('pet', cat.uuid)}>Pet (1🐟)</button>
                        <button onClick={()=>interact('cut', cat.uuid)}>Cut Nail</button>
                        <button onClick={()=>interact('wander', cat.uuid)}>{moving ? 'Stop' : 'Wander'}</button>
                        <button style={{background:'#c62828'}} onClick={()=>{clickSound(); setInteractingCatId(null)}}>Close</button>
                    </div>
                )}
                <div className={`Character ${moving ? 'is-moving' : 'is-idle'} ${dir==='right'?'face-right':'face-left'}`} onClick={() => {clickSound(); setInteractingCatId(interactingCatId === cat.uuid ? null : cat.uuid)}}>
                    <img src={`/assets/cat_${cat.id}.png`} className="Character_spritesheet" alt="cat" />
                </div>
                <div style={{textAlign:'center', fontSize:'8px', textShadow:'1px 1px 0 #000', marginTop:'5px'}}>{cat.name}</div>
             </div>
        )})}
    </div>
  );
}

export default App;