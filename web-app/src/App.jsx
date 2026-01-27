import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect, useRef } from 'react';
import './App.css';

// --- CONFIGURATION ---
const GAME_STORE_ID = '0x1fd26dbce4a68bb06c8bf4c8763552a7faa20085622bfecbb036cb7edd40ed53';

// Tỷ lệ đào cơ bản (chưa tính Level và Gear)
const MINING_RATE = {
    'R': { fish: 0.1, meow: 0.0001, label: 'Standard' },
    'SR': { fish: 0.3, meow: 0.001, label: 'High' },
    'SSR': { fish: 1.5, meow: 0.03, label: 'Divine' }
};

// --- CORE SYSTEM: 3-AXIS PERSONALITY ---
const PERSONALITY_MAP = {
    'Gentle':       { w: 3,  c: 0,  e: 1, desc: "A peaceful soul." },
    'Chill':        { w: 2,  c: -1, e: 0, desc: "Just vibes." },
    'Angry':        { w: -2, c: 3,  e: 2, desc: "Fueled by rage." },
    'Naughty':      { w: -1, c: 2,  e: 3, desc: "Zoomies all day." },
    'Calm':         { w: 3,  c: -2, e: -1, desc: "Unshakable rock." },
    'Lazy':         { w: 1,  c: -1, e: -3, desc: "Conservation of energy." },
    'Smart':        { w: 1,  c: 1,  e: 2, desc: "Calculated efficiency." },
    'Dominant':     { w: -2, c: 2,  e: 2, desc: "The Boss." },
    'Affectionate': { w: 4,  c: 0,  e: 1, desc: "Love engine." },
    'Cold':         { w: -3, c: 1,  e: 0, desc: "Winter is here." }
};

const CAT_DB = [
    { id: 0, name: 'Gray', rarity: 'R', personality: 'Lazy' },
    { id: 1, name: 'DarkPurple', rarity: 'R', personality: 'Cold' },
    { id: 2, name: 'White', rarity: 'R', personality: 'Gentle' },
    { id: 3, name: 'Orange', rarity: 'R', personality: 'Naughty' },
    { id: 4, name: 'Light', rarity: 'R', personality: 'Affectionate' },
    { id: 5, name: 'Black', rarity: 'SR', personality: 'Calm' },
    { id: 6, name: 'Tuxedo', rarity: 'SR', personality: 'Smart' },
    { id: 7, name: 'ThreeTones', rarity: 'SR', personality: 'Chill' },
    { id: 8, name: 'Golden', rarity: 'SSR', personality: 'Dominant' },
    { id: 9, name: 'Pink', rarity: 'SR', personality: 'Affectionate' },
    { id: 10, name: 'Rainbow', rarity: 'SSR', personality: 'Smart' },
    { id: 11, name: 'Alien', rarity: 'SSR', personality: 'Angry' },
    { id: 12, name: 'Purple', rarity: 'R', personality: 'Chill' }
];

// Gear Database
const GEAR_DB = [
    { id: 'g1', name: 'Red Bow', cost: 200, boost: 0.1, drain: 0.05, durability: 500, fragility: 1, type: 'gear', img: '🎀' },
    { id: 'g2', name: 'Gold Bell', cost: 1000, boost: 0.3, drain: 0.1, durability: 1200, fragility: 0.8, type: 'gear', img: '🔔' },
    { id: 'g3', name: 'Rocket Pack', cost: 5000, boost: 1.0, drain: 0.5, durability: 3000, fragility: 0.5, type: 'gear', img: '🚀' },
];

// Decor Database
const DECOR_DB = [
    { id: 'd1', name: 'Taiga Plant', cost: 500, type: 'decor', img: '/assets/plant.png', style: { width: '40px' } },
    { id: 'd2', name: 'Scratch Post', cost: 800, type: 'decor', img: '/assets/catpost.png', style: { width: '60px' } },
    { id: 'd3', name: 'Fish Painting', cost: 1500, type: 'decor', img: '/assets/fish_painting.png', style: { width: '80px' } },
];

const CARD_ICONS = ['🐟', '🦴', '🐭', '🦀', '🧶', '🐱'];
const SLOT_SYMBOLS = [{ id: 0, img: '/assets/slot-symbol1.png', val: 7 }, { id: 1, img: '/assets/slot-symbol2.png', val: 3 }, { id: 2, img: '/assets/slot-symbol3.png', val: 2 }, { id: 3, img: '/assets/slot-symbol4.png', val: 1 }];

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // --- STATE ---
  const [localFish, setLocalFish] = useState(() => parseFloat(localStorage.getItem('fish') || '500'));
  const [localMeow, setLocalMeow] = useState(() => parseFloat(localStorage.getItem('meow') || '0'));
  
  const [inventory, setInventory] = useState(() => {
      const saved = JSON.parse(localStorage.getItem('inventory') || '[]');
      if (saved.length === 0) {
          const starter = { ...CAT_DB[0], uuid: Date.now(), type: 'cat', isNew: true, hunger: 100, level: 1, equippedGear: null };
          return [starter];
      }
      return saved;
  });

  const [equippedIds, setEquippedIds] = useState(() => {
      const saved = JSON.parse(localStorage.getItem('equipped') || '[]');
      if (saved.length === 0 && inventory.length > 0) return [inventory[0].uuid];
      return saved;
  });

  // --- NEW FEATURES STATE ---
  const [activeShopTab, setActiveShopTab] = useState('box'); // 'box', 'gear', 'decor'
  
  // Placed Decor: Array of { uuid, id, x, y, img }
  const [placedDecor, setPlacedDecor] = useState(() => JSON.parse(localStorage.getItem('placedDecor') || '[]'));
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedDecorId, setDraggedDecorId] = useState(null);

  // Game Logic State
  const [pityCounter, setPityCounter] = useState(() => parseInt(localStorage.getItem('pity') || '0'));
  const [pendingRewards, setPendingRewards] = useState({ fish: 0, meow: 0 });
  const [teamStats, setTeamStats] = useState({ w: 0, c: 0, e: 0, label: "Neutral" });

  // UI State
  const [activeTab, setActiveTab] = useState(null); 
  const [gachaResults, setGachaResults] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [bookDetailCat, setBookDetailCat] = useState(null);
  const [filterRarity, setFilterRarity] = useState('ALL');
  const [inspectCat, setInspectCat] = useState(null); 
  const [showGearSelect, setShowGearSelect] = useState(false);

  // Interaction State
  const [catPos, setCatPos] = useState({});
  const [catDir, setCatDir] = useState({});
  const [movingCats, setMovingCats] = useState({});
  const [interactingCatId, setInteractingCatId] = useState(null);

  // Audio & Settings
  const bgmRef = useRef(new Audio('/assets/sounds/bgm_main.mp3'));
  const sfxRef = useRef({});
  const [musicVol, setMusicVol] = useState(0.5);
  const [sfxVol, setSfxVol] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);

  // Arcade State
  const [gameCount, setGameCount] = useState(() => parseInt(localStorage.getItem('gameCount') || '0'));
  const [lastLoginDate, setLastLoginDate] = useState(() => localStorage.getItem('lastLoginDate') || '');
  const [selectedGame, setSelectedGame] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [gameResultMsg, setGameResultMsg] = useState('');
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedCards, setMatchedCards] = useState([]);
  const [timer, setTimer] = useState(60);
  const [gameState, setGameState] = useState('idle');
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState('heads');
  const [slotReels, setSlotReels] = useState([0, 1, 2]); 
  const [isSpinning, setIsSpinning] = useState(false);

  // --- SYNC & AUDIO ---
  useEffect(() => { localStorage.setItem('meow', localMeow); }, [localMeow]);
  useEffect(() => { localStorage.setItem('fish', localFish); }, [localFish]);
  useEffect(() => { localStorage.setItem('inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('equipped', JSON.stringify(equippedIds)); }, [equippedIds]);
  useEffect(() => { localStorage.setItem('pity', pityCounter); }, [pityCounter]);
  useEffect(() => { localStorage.setItem('placedDecor', JSON.stringify(placedDecor)); }, [placedDecor]);
  useEffect(() => { localStorage.setItem('gameCount', gameCount); localStorage.setItem('lastPlayedDate', new Date().toDateString()); }, [gameCount]);

  useEffect(() => {
      bgmRef.current.loop = true; bgmRef.current.volume = musicVol;
      bgmRef.current.play().catch(() => {});
      ['ui_click.mp3', 'game_win.mp3', 'slot_spin.mp3', 'cat_meow.mp3', 'cat_eat.mp3', 'upgrade.mp3', 'break.mp3'].forEach(n => {
          sfxRef.current[n] = new Audio(`/assets/sounds/${n}`);
      });
  }, []);
  useEffect(() => { bgmRef.current.volume = musicVol; }, [musicVol]);

  const playSfx = (name) => {
      if (sfxVol <= 0) return;
      const audio = sfxRef.current[name];
      if (audio) { audio.currentTime = 0; audio.volume = sfxVol; audio.play().catch(()=>{}); }
  };
  const clickSound = () => playSfx('ui_click.mp3');

  // --- 3-AXIS SYNERGY CALCULATION ---
  useEffect(() => {
      const activeCats = inventory.filter(c => equippedIds.includes(c.uuid));
      let totalW = 0, totalC = 0, totalE = 0;
      activeCats.forEach(cat => {
          const stats = PERSONALITY_MAP[cat.personality] || { w: 0, c: 0, e: 0 };
          totalW += stats.w; totalC += stats.c; totalE += stats.e;
      });
      let label = "Balanced";
      if (totalC > 5) label = "Chaotic (+Crit)";
      else if (totalW > 5) label = "Harmonious (+Stable)";
      else if (totalE > 5) label = "Energetic (+Speed)";
      setTeamStats({ w: totalW, c: totalC, e: totalE, label });
  }, [equippedIds, inventory]);

  // --- MINING LOOP (Levels + Gear + Energy) ---
  useEffect(() => {
      const miningTick = setInterval(() => {
          setInventory(prevInv => {
              let earnedFish = 0; let earnedMeow = 0;
              let anyGearBroke = false;
              const nextInv = prevInv.map(cat => {
                  if (equippedIds.includes(cat.uuid)) {
                      if (cat.hunger > 0) {
                          const rates = MINING_RATE[cat.rarity] || MINING_RATE['R'];
                          // 1. Level Multiplier
                          const levelMult = 1 + ((cat.level || 1) * 0.1); 
                          // 2. Synergy Bonus (Energy)
                          const energyBonus = 1 + (teamStats.e * 0.02); 
                          // 3. Gear Logic
                          let gearMult = 0; let hungerDrain = 0.1; let nextGear = cat.equippedGear;
                          if (nextGear) {
                              gearMult = nextGear.boost;
                              hungerDrain += nextGear.drain; 
                              nextGear = { ...nextGear, durability: nextGear.durability - nextGear.fragility };
                              if (nextGear.durability <= 0) { nextGear = null; anyGearBroke = true; }
                          }
                          // Final Formula
                          let tickFish = rates.fish * levelMult * energyBonus * (1 + gearMult);
                          if (Math.random() < (teamStats.c * 0.05)) tickFish *= 2; // Chaos Crit

                          earnedFish += tickFish;
                          if (Math.random() < rates.meow) earnedMeow += 1;
                          return { ...cat, hunger: Math.max(0, cat.hunger - hungerDrain), equippedGear: nextGear };
                      }
                  }
                  return cat;
              });
              if (anyGearBroke) playSfx('break.mp3');
              if (earnedFish > 0 || earnedMeow > 0) setPendingRewards(prev => ({ fish: prev.fish + earnedFish, meow: prev.meow + earnedMeow }));
              return nextInv;
          });
      }, 3000); 
      return () => clearInterval(miningTick);
  }, [equippedIds, teamStats]);

  // --- CAT MOVEMENT LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
        setCatPos(prev => {
            const next = { ...prev }; const nextDir = { ...catDir };
            equippedIds.forEach((id, idx) => {
                if(!next[id]) next[id] = 10 + (idx * 15);
                if (movingCats[id]) {
                    let x = next[id]; let dir = nextDir[id] || 'right';
                    if (dir === 'right') { x += 0.5; if (x > 90) dir = 'left'; } else { x -= 0.5; if (x < 5) dir = 'right'; }
                    next[id] = x; nextDir[id] = dir;
                }
            });
            setCatDir(nextDir); return next;
        });
    }, 50);
    return () => clearInterval(interval);
  }, [equippedIds, movingCats, catDir]);

// --- DRAG & DROP DECOR LOGIC (FIXED) ---
  
  const handleDragStart = (e, uuid, fromInventory = false) => {
      // Chỉ cho phép kéo khi bật Edit Mode
      if (!isEditMode) return;
      
      e.preventDefault(); // Ngăn trình duyệt kéo ảnh (ghost image)
      e.stopPropagation(); // Ngăn sự kiện click lan ra background

      // Nếu kéo từ thanh Inventory (tạo mới)
      if (fromInventory) {
          const baseItem = inventory.find(i => i.uuid === uuid);
          if (baseItem) {
              // Kiểm tra xem item này đã được đặt chưa (tránh dupe nếu logic inventory không ẩn nó)
              const isAlreadyPlaced = placedDecor.some(p => p.uuid === uuid);
              if(!isAlreadyPlaced) {
                  const newItem = { 
                      ...baseItem, 
                      x: e.clientX, 
                      y: e.clientY 
                  };
                  setPlacedDecor(prev => [...prev, newItem]);
              }
          }
      }
      
      // Đặt ID đang kéo để kích hoạt handleMouseMove
      setDraggedDecorId(uuid);
  };

  const handleMouseMove = (e) => {
      // Nếu không phải edit mode hoặc không có item nào đang được giữ chuột thì bỏ qua
      if (!isEditMode || !draggedDecorId) return;
      
      e.preventDefault();

      setPlacedDecor(prev => prev.map(item => {
          if (item.uuid === draggedDecorId) {
              // Cập nhật tọa độ theo chuột
              return { ...item, x: e.clientX, y: e.clientY };
          }
          return item;
      }));
  };

  const handleMouseUp = () => { 
      setDraggedDecorId(null); 
  };

  const handleDecorDoubleClick = (e, uuid) => {
      if (!isEditMode) return;
      e.stopPropagation(); // Quan trọng: Ngăn click lan ra ngoài
      playSfx('break.mp3'); // Âm thanh xóa (tùy chọn)
      
      // Xóa khỏi placedDecor -> Nó sẽ tự động hiện lại trong Inventory bar nhờ logic render của bạn
      setPlacedDecor(prev => prev.filter(p => p.uuid !== uuid)); 
  };

  
  // FIX: SUI TOP UP LOGIC (Reduced required amount for testnet success)
  const SUI_MIST_AMOUNT_TEST = 10_000; // 0.01 SUI in Mist
  
  const buyFish = () => {
    clickSound(); 
    if (!account) return alert("Connect Wallet!");
    
    const tx = new Transaction(); 
    
    // Split 0.01 SUI from the primary gas coin. This small amount increases the chance of success.
    const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(SUI_MIST_AMOUNT_TEST)]); 
    tx.transferObjects([paymentCoin], tx.pure.address(GAME_STORE_ID)); 
    
    signAndExecute({ transaction: tx }, { 
        onSuccess: () => { 
            // Grant the full 1000 FISH reward (as per the UX display)
            setLocalFish(p => p + 10000); 
            playSfx('game_win.mp3'); 
            alert("Payment Success! Received +1000 FISH (Simulated 1 SUI top-up)"); 
        }, 
        onError: (err) => { 
            console.error("SUI Transaction Failed:", err);
            alert("Transaction Failed. Ensure your connected wallet has SUI funds to cover the transaction fee. Error details in console."); 
        }
    });
  };
  const buyItem = (item) => {
      clickSound();
      if (localFish < item.cost) return alert("Not enough FISH!");
      setLocalFish(p => p - item.cost);
      if (item.type === 'decor') {
          const newDecor = { ...item, uuid: Date.now(), type: 'decor' };
          setInventory(prev => [...prev, newDecor]);
          playSfx('ui_click.mp3'); alert("Decor purchased! Open 'EDIT HOUSE' to place it.");
      } else if (item.type === 'gear') {
          const newItem = { ...item, uuid: Date.now(), type: 'gear_item', maxDurability: item.durability };
          setInventory(prev => [...prev, newItem]);
          playSfx('ui_click.mp3'); alert("Gear purchased! Inspect a cat to equip.");
      }
  };

  const levelUpCat = (cat) => {
      const currentLevel = cat.level || 1;
      let cost = currentLevel * 200;
      if (currentLevel % 10 === 0) cost *= 3;
      if (localFish < cost) return alert(`Need ${cost} FISH!`);
      
      clickSound(); setLocalFish(p => p - cost); playSfx('upgrade.mp3');
      setInventory(prev => prev.map(c => c.uuid === cat.uuid ? { ...c, level: currentLevel + 1 } : c));
      setInspectCat(prev => ({ ...prev, level: currentLevel + 1 }));
  };

  const equipGearToCat = (cat, gearItem) => {
      clickSound();
      setInventory(prev => {
          const targetCat = prev.find(c => c.uuid === cat.uuid);
          let itemsToAdd = [];
          if (targetCat.equippedGear) {
              itemsToAdd.push({ ...targetCat.equippedGear, type: 'gear_item', uuid: Date.now() + 'old' });
          }
          const newInv = prev.filter(i => i.uuid !== gearItem.uuid);
          return [...newInv, ...itemsToAdd].map(c => {
              if (c.uuid === cat.uuid) return { ...c, equippedGear: { ...gearItem, uuid: undefined } };
              return c;
          });
      });
      setShowGearSelect(false); setInspectCat(null);
  };
  
  const unequipGear = (cat) => {
      if(!cat.equippedGear) return; clickSound();
      setInventory(prev => {
          const returnedGear = { ...cat.equippedGear, type: 'gear_item', uuid: Date.now() };
          return [...prev, returnedGear].map(c => {
              if (c.uuid === cat.uuid) return { ...c, equippedGear: null };
              return c;
          });
      });
      setInspectCat(null);
  };

  const openBlindBox = (times) => {
      const cost = times * 160; if (localFish < cost) return alert("Not enough FISH!");
      setLocalFish(p => p - cost); setIsRolling(true); playSfx('slot_spin.mp3'); 
      setTimeout(() => {
          const newItems = []; let currentPity = pityCounter;
          for(let i=0; i<times; i++) {
              currentPity++; let rarity = 'R'; let roll = Math.random() * 100;
              if (currentPity >= 60) { rarity = 'SSR'; currentPity = 0; } else { if (roll < 1) { rarity = 'SSR'; currentPity = 0; } else if (roll < 6) rarity = 'SR'; }
              const candidates = CAT_DB.filter(x => x.rarity === rarity);
              const item = candidates[Math.floor(Math.random() * candidates.length)];
              newItems.push({ ...item, uuid: Date.now() + Math.random(), type: 'cat', isNew: true, hunger: 100, level: 1 });
          }
          setPityCounter(currentPity); setInventory([...inventory, ...newItems]); setGachaResults(newItems); setIsRolling(false);
          const hasRare = newItems.some(i => i.rarity === 'SSR' || i.rarity === 'SR'); playSfx(hasRare ? 'game_win.mp3' : 'ui_click.mp3');
      }, 2500);
  };

  // Other Actions
  const handleDailyLogin = () => { clickSound(); const today = new Date().toDateString(); if (lastLoginDate === today) return alert("Already claimed today!"); setLocalFish(f => f + 100); setLastLoginDate(today); playSfx('game_win.mp3'); alert(`Daily Login! +100 FISH!`); };
  const claimRewards = () => { if (pendingRewards.fish <= 0) return; clickSound(); playSfx('game_win.mp3'); setLocalFish(f => f + Math.floor(pendingRewards.fish)); setLocalMeow(m => m + pendingRewards.meow); setPendingRewards({ fish: 0, meow: 0 }); };
  const interact = (type, uuid) => {
    if (type === 'wander') { clickSound(); setMovingCats(p => ({...p, [uuid]: !p[uuid]})); setInteractingCatId(null); return; }
    if (type === 'feed') { if (localFish < 5) return alert("Need 5 FISH"); setLocalFish(p => p - 5); setInventory(prev => prev.map(c => c.uuid === uuid ? { ...c, hunger: Math.min(100, c.hunger + 50) } : c)); playSfx('cat_eat.mp3'); setInteractingCatId(null); return; }
    if (type === 'pet') { if (localFish < 1) return alert("Need 1 FISH"); setLocalFish(p => p - 1); playSfx('cat_meow.mp3'); setInteractingCatId(null); return; }
  };
  const toggleEquip = (uuid) => { if(equippedIds.includes(uuid)) setEquippedIds(p=>p.filter(id=>id!==uuid)); else { if(equippedIds.length>=6) return alert("Max 6 cats"); setEquippedIds(p=>[...p, uuid]); } setInspectCat(null); };

  // Arcade Functions (Simplified for brevity)
  const checkCanPlay = () => { if (gameCount >= 10) { alert("Limit 10/10!"); return false; } return true; };
  const startMemoryGame = () => { clickSound(); if(!checkCanPlay()) return; setCards([...CARD_ICONS, ...CARD_ICONS].sort(()=>Math.random()-0.5).map((icon,id)=>({id, icon}))); setFlippedCards([]); setMatchedCards([]); setTimer(60); setGameState('playing'); setGameResultMsg(''); };
  const handleCardClick = (id) => { if (gameState !== 'playing' || flippedCards.length === 2 || matchedCards.includes(id)) return; playSfx('ui_click.mp3'); const newFlipped = [...flippedCards, id]; setFlippedCards(newFlipped); if (newFlipped.length === 2) { const [id1, id2] = newFlipped; if (cards[id1].icon === cards[id2].icon) { setMatchedCards(p => { const newM = [...p, id1, id2]; if(newM.length === cards.length) { setGameState('won'); setLocalFish(f=>f+10); setGameCount(c=>c+1); playSfx('game_win.mp3'); } return newM; }); setFlippedCards([]); } else { setTimeout(() => setFlippedCards([]), 800); } } };
  const playCoinFlip = (choice) => { clickSound(); if (!checkCanPlay() || isFlipping || localFish < betAmount) return; setLocalFish(p => p - betAmount); setIsFlipping(true); setGameResultMsg(''); playSfx('slot_spin.mp3'); let flips = 0; const interval = setInterval(() => { setCoinSide(prev => prev === 'heads' ? 'tails' : 'heads'); flips++; if (flips > 10) { clearInterval(interval); const result = Math.random() > 0.5 ? 'heads' : 'tails'; setCoinSide(result); setIsFlipping(false); setGameCount(c => c + 1); if (result === choice) { const win = betAmount * 2; setLocalFish(p => p + win); setGameResultMsg(`WIN! +${win}🐟`); playSfx('game_win.mp3'); } else { setGameResultMsg(`LOST -${betAmount}🐟`); } } }, 150); };
  const playSlotMachine = () => { clickSound(); if (!checkCanPlay() || isSpinning || localFish < betAmount) return; setLocalFish(p => p - betAmount); setIsSpinning(true); setGameResultMsg(''); playSfx('slot_spin.mp3'); const interval = setInterval(() => { setSlotReels([Math.floor(Math.random()*4), Math.floor(Math.random()*4), Math.floor(Math.random()*4)]); }, 100); setTimeout(() => { clearInterval(interval); const finalReels = [Math.floor(Math.random()*4), Math.floor(Math.random()*4), Math.floor(Math.random()*4)]; setSlotReels(finalReels); setIsSpinning(false); setGameCount(c => c + 1); const [r1, r2, r3] = finalReels; let multiplier = 0; if (r1 === r2 && r2 === r3) { multiplier = (SLOT_SYMBOLS[r1].val === 7) ? 10 : 5; } else if (r1 === r2 || r2 === r3 || r1 === r3) { multiplier = 2; } if (multiplier > 0) { const win = betAmount * multiplier; setLocalFish(p => p + win); setGameResultMsg(`JACKPOT! x${multiplier} (+${win}🐟)`); playSfx('game_win.mp3'); } else { setGameResultMsg(`LOST -${betAmount}🐟`); } }, 2000); };

  // --- RENDERERS ---
  const renderShop = () => (
      <div className="gacha-panel">
          <div className="shop-tabs">
              <button className={`tab-btn ${activeShopTab==='box'?'active':''}`} onClick={()=>{clickSound(); setActiveShopTab('box')}}>BLIND BOX</button>
              <button className={`tab-btn ${activeShopTab==='gear'?'active':''}`} onClick={()=>{clickSound(); setActiveShopTab('gear')}}>GEAR</button>
              <button className={`tab-btn ${activeShopTab==='decor'?'active':''}`} onClick={()=>{clickSound(); setActiveShopTab('decor')}}>DECOR</button>
          </div>
          {activeShopTab === 'box' && (
              <>
                <div className="gacha-banner blind-box"><div className="blind-box-visual">?</div><div className="banner-info">SSR: 1% | SR: 5% | Pity: {pityCounter}/60</div></div>
                <div className="gacha-actions">
                    <div className="btn-roll" onClick={()=>openBlindBox(1)}><span>OPEN 1</span><br/><span>160 🐟</span></div>
                    <div className="btn-roll premium" onClick={()=>openBlindBox(10)}><span>OPEN 10</span><br/><span>1600 🐟</span></div>
                </div>
                <div className="sui-top-up-section"><div><div style={{color:'white', fontSize:'10px'}}>WALLET BALANCE</div><div className="sui-rate-text">1 SUI = 1000 FISH (TEST)</div></div><button className="btn-action" style={{width:'auto', padding:'10px', background:'#76ff03', color:'black', fontWeight:'bold'}} onClick={buyFish}>TOP UP 1 SUI</button></div>
              </>
          )}
          {activeShopTab === 'gear' && (
              <div className="shop-grid">{GEAR_DB.map(g => (<div key={g.id} className="shop-item"><span style={{fontSize:'24px'}}>{g.img}</span><h4>{g.name}</h4><div style={{fontSize:'8px'}}>Boost: +{g.boost*100}%</div><div style={{fontSize:'8px', color:'red'}}>Drain: +{g.drain}</div><div className="shop-price">{g.cost} 🐟</div><button onClick={()=>buyItem(g)}>BUY</button></div>))}</div>
          )}
          {activeShopTab === 'decor' && (
              <div className="shop-grid">{DECOR_DB.map(d => (<div key={d.id} className="shop-item"><img src={d.img} alt="d"/><h4>{d.name}</h4><div style={{fontSize:'8px', color:'purple', fontStyle:'italic'}}>Flex Item</div><div className="shop-price">{d.cost} 🐟</div><button onClick={()=>buyItem(d)}>BUY</button></div>))}</div>
          )}
      </div>
  );

  const renderInspectModal = () => {
      if (!inspectCat) return null;
      const currentLevel = inspectCat.level || 1;
      const nextLevel = currentLevel + 1;
      const upgradeCost = currentLevel * 200;
      const basePow = (MINING_RATE[inspectCat.rarity] || MINING_RATE['R']).fish;
      const currentSpeed = (basePow * (1 + currentLevel * 0.1)).toFixed(2);
      const nextSpeed = (basePow * (1 + nextLevel * 0.1)).toFixed(2);
      const availableGear = inventory.filter(i => i.type === 'gear_item');

      return (
          <div className="inspect-overlay">
              <div className="cat-inspect-card" style={{width:'500px'}}>
                  <button className="btn-close" onClick={()=>{setInspectCat(null); setShowGearSelect(false)}}>X</button>
                  <div className="inspect-header" style={{borderBottom:'2px solid #555', paddingBottom:'10px', marginBottom:'15px'}}>
                      <h2 style={{margin:0, color:'gold'}}>{inspectCat.name}</h2>
                      <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px'}}>
                           <span className={`rarity-tag ${inspectCat.rarity}`}>{inspectCat.rarity}</span>
                           <span style={{color:'#aaa'}}>Level {currentLevel}</span>
                      </div>
                  </div>
                  <div style={{display:'flex', gap:'20px', textAlign:'left'}}>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}}>
                          <div className="cat-portrait-large" style={{backgroundImage: `url(/assets/cat_${inspectCat.id}.png)`, width:'140px', height:'140px'}}>
                              {inspectCat.equippedGear && <div style={{position:'absolute', bottom:0, right:0, fontSize:'30px'}}>{inspectCat.equippedGear.img}</div>}
                          </div>
                          <div style={{width:'100%'}}>
                              <div style={{fontSize:'10px', marginBottom:'2px', color:'#aaa'}}>GEAR SLOT</div>
                              <div className="gear-equip-section">
                                  <div className={`gear-slot ${inspectCat.equippedGear ? 'filled' : ''}`} onClick={() => { if(inspectCat.equippedGear) unequipGear(inspectCat); else setShowGearSelect(!showGearSelect); }}>
                                      {inspectCat.equippedGear ? inspectCat.equippedGear.img : '+'}
                                  </div>
                                  <div style={{fontSize:'10px', flex:1}}>
                                      {inspectCat.equippedGear ? (
                                          <><div style={{color:'gold'}}>{inspectCat.equippedGear.name}</div><div style={{color:'#00e676'}}>Dur: {inspectCat.equippedGear.durability}</div></>
                                      ) : <span style={{color:'#777'}}>No Gear Equipped</span>}
                                  </div>
                              </div>
                              {showGearSelect && !inspectCat.equippedGear && (
                                  <div className="mini-inventory">
                                      {availableGear.length === 0 ? <div style={{fontSize:'10px', color:'#aaa', padding:'5px'}}>No gear</div> : availableGear.map(g => (<button key={g.uuid} className="pixel-btn" style={{width:'40px', height:'40px', fontSize:'20px'}} onClick={()=>equipGearToCat(inspectCat, g)}>{g.img}</button>))}
                                  </div>
                              )}
                          </div>
                      </div>
                      <div className="stats-block" style={{flex:1}}>
                          <h4 style={{margin:'0 0 10px 0', borderBottom:'1px dashed #777'}}>STATS</h4>
                          <div className="ascend-stat-row"><span>Power:</span><span>{currentSpeed} <span style={{color:'#aaa'}}>➔</span> <span className="stat-upgrade">{nextSpeed}</span></span></div>
                          <div className="ascend-stat-row"><span>Eff:</span><span>{currentLevel*10}% <span style={{color:'#aaa'}}>➔</span> <span className="stat-upgrade">{(nextLevel)*10}%</span></span></div>
                          <div style={{margin:'15px 0', background:'#263238', padding:'10px', borderRadius:'5px'}}>
                               <div style={{fontSize:'10px', color:'gold', marginBottom:'5px'}}>ASCENSION COST</div>
                               <div style={{fontSize:'18px', fontWeight:'bold'}}>{upgradeCost} 🐟</div>
                          </div>
                          <button className="btn-action upgrade-btn" onClick={()=>levelUpCat(inspectCat)}>ASCEND Lv.{nextLevel}</button>
                          {equippedIds.includes(inspectCat.uuid) ? 
                              <button className="btn-action btn-unequip" style={{marginTop:'10px'}} onClick={()=>{toggleEquip(inspectCat.uuid); setInspectCat(null)}}>UNEQUIP CAT</button> :
                              <button className="btn-action" style={{marginTop:'10px', background:'#2196f3'}} onClick={()=>{toggleEquip(inspectCat.uuid); setInspectCat(null)}}>EQUIP CAT</button>
                          }
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  // --- MAIN RENDER ---
  return (
    <div className="game-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} style={{cursor: isEditMode && draggedDecorId ? 'grabbing' : 'default'}}>
        {/* EDIT MODE TOGGLE */}
        <button className={`btn-edit-mode ${isEditMode ? 'active' : ''}`} onClick={()=>{clickSound(); setIsEditMode(!isEditMode)}}>{isEditMode ? '✅ SAVE LAYOUT' : '🛠 EDIT HOUSE'}</button>

{/* DECOR LAYER */}
        <div className={`decor-layer ${isEditMode ? 'is-editing' : ''}`}>
            {placedDecor.map((item) => (
                <img 
                    key={item.uuid} 
                    src={item.img} 
                    className={`decor-placed ${draggedDecorId === item.uuid ? 'dragging' : ''}`} 
                    // Style quan trọng: transform translate để tâm ảnh nằm giữa chuột
                    style={{ left: item.x, top: item.y, width: item.style?.width || '64px', transform: 'translate(-50%, -50%)' }} 
                    alt="d" 
                    onMouseDown={(e) => handleDragStart(e, item.uuid, false)} // False: Kéo item đã có
                    onDoubleClick={(e) => handleDecorDoubleClick(e, item.uuid)} // Truyền e vào
                />
            ))}
        </div>

        {/* EDIT INVENTORY BAR */}
        {isEditMode && (
            <div className="edit-mode-ui">
                <div style={{color:'gold', fontSize:'12px', marginBottom:'5px'}}>DRAG TO PLACE • DOUBLE CLICK TO REMOVE</div>
                <div className="decor-inventory-bar">
                    {inventory.filter(i => i.type === 'decor' && !placedDecor.some(p => p.uuid === i.uuid)).length === 0 ? 
                        <span style={{color:'#aaa', fontSize:'10px'}}>No decorations. Buy some in Shop!</span> :
                        inventory.filter(i => i.type === 'decor' && !placedDecor.some(p => p.uuid === i.uuid)).map(d => (
                            <div key={d.uuid} className="decor-slot-item" onMouseDown={(e) => handleDragStart(e, d.uuid, true)}><img src={d.img} style={{width:'40px', height:'40px'}} alt="i" /></div>
                        ))
                    }
                </div>
            </div>
        )}

        {/* TOP BAR */}
        <div className="top-bar">
            <div className="group-btn">
                <button className="btn-menu" style={{background:'#d84315'}} onClick={() => {clickSound(); setActiveTab('shop')}}>SHOP</button>
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

        {isRolling && <div className="minigame-overlay" style={{zIndex: 4000}}><div className="rolling-container"><div className="rolling-box shake-anim">?</div><div className="rolling-text">OPENING...</div></div></div>}
        {showSettings && <div className="minigame-overlay"><div className="pixel-panel settings-panel"><div className="setting-row"><label>MUSIC</label><input type="range" max="1" step="0.1" value={musicVol} onChange={(e)=>setMusicVol(parseFloat(e.target.value))} /></div><div className="setting-row"><label>SFX</label><input type="range" max="1" step="0.1" value={sfxVol} onChange={(e)=>setSfxVol(parseFloat(e.target.value))} /></div><button className="btn-action" onClick={()=>{clickSound(); setShowSettings(false)}}>CLOSE</button></div></div>}

        {activeTab === 'shop' && <div className="minigame-overlay"><div className="pixel-panel"><button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null)}}>X</button>{gachaResults ? <div className="gacha-panel"><h2 style={{color:'gold', fontSize:'30px'}}>RESULTS</h2><div className="result-grid">{gachaResults.map((item, i) => (<div key={i} className={`result-item ${item.rarity}`}><div className="item-img" style={{backgroundImage: `url(/assets/cat_${item.id}.png)`}}></div><span>{item.rarity}</span></div>))}</div><button className="btn-action" onClick={()=>{clickSound(); setGachaResults(null)}}>COLLECT</button></div> : renderShop()}</div></div>}

        {activeTab === 'house' && (
            <div className="minigame-overlay">
                <div className="pixel-panel" style={{width:'800px', position:'relative'}}>
                    <button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null); setInspectCat(null)}}>X</button>
                    <h2 style={{color:'gold', textShadow:'2px 2px 0 #000'}}>MY HOUSE</h2>
                    <div className="rpg-stats-container">
                        <div className="rpg-stat-bars">
                            <div className="rpg-stat-row"><span className="stat-icon">🔥</span><span className="stat-label" style={{color:'#ff9800'}}>WARMTH</span><div className="pixel-bar-bg"><div className="pixel-bar-fill bar-w" style={{width: `${Math.min(100, Math.max(5, (teamStats.w + 10) * 3))}%`}}></div></div><span className="stat-number">{teamStats.w}</span></div>
                            <div className="rpg-stat-row"><span className="stat-icon">⚡</span><span className="stat-label" style={{color:'#f44336'}}>CHAOS</span><div className="pixel-bar-bg"><div className="pixel-bar-fill bar-c" style={{width: `${Math.min(100, Math.max(5, (teamStats.c + 10) * 3))}%`}}></div></div><span className="stat-number">{teamStats.c}</span></div>
                            <div className="rpg-stat-row"><span className="stat-icon">🔋</span><span className="stat-label" style={{color:'#29b6f6'}}>ENERGY</span><div className="pixel-bar-bg"><div className="pixel-bar-fill bar-e" style={{width: `${Math.min(100, Math.max(5, (teamStats.e + 10) * 3))}%`}}></div></div><span className="stat-number">{teamStats.e}</span></div>
                        </div>
                        <div className="rpg-synergy-badge"><div style={{fontSize:'8px', color:'#aaa', marginBottom:'5px'}}>ACTIVE EFFECT</div><div style={{color:'gold', fontWeight:'bold', fontSize:'12px', lineHeight:'1.5'}}>{teamStats.label}</div></div>
                    </div>
                    <div className="filter-bar">{['ALL','R','SR','SSR'].map(r => (<button key={r} className={filterRarity===r?'active':''} onClick={()=>{clickSound(); setFilterRarity(r)}}>{r}</button>))}</div>
                    <div className="house-grid">{inventory.filter(i => i.type === 'cat').filter(i => filterRarity === 'ALL' || i.rarity === filterRarity).map(cat => (<div key={cat.uuid} className={`house-slot ${equippedIds.includes(cat.uuid) ? 'active' : ''}`} onClick={() => {clickSound(); setInspectCat(cat)}}><div className="level-badge">{cat.level || 1}</div><div className="pixel-icon" style={{backgroundImage: `url(/assets/cat_${cat.id}.png)`}}></div><div className="hunger-bar"><div style={{width:`${cat.hunger}%`, background: cat.hunger<20?'red':'#00e676'}}></div></div><span style={{fontSize:'7px', color:'#aaa'}}>{cat.personality}</span>{cat.equippedGear && <div style={{position:'absolute', bottom:2, right:2, fontSize:'10px'}}>{cat.equippedGear.img}</div>}{equippedIds.includes(cat.uuid) && <div className="equipped-badge">E</div>}</div>))}</div>
                </div>
            </div>
        )}

        {inspectCat && renderInspectModal()}

        {activeTab === 'arcade' && <div className="minigame-overlay"><div className="pixel-panel arcade-panel"><button className="btn-close" onClick={()=>{clickSound(); setActiveTab(null); setSelectedGame(null)}}>X</button>{!selectedGame ? (<><h2 style={{textShadow:'3px 4px 2px #5c69ff', marginTop:'30px'}}>ARCADE CENTER</h2><p style={{fontSize:'14px', color:'yellow'}}>Daily Plays: {gameCount}/10</p><div className="arcade-menu"><button className="game-card-btn" onClick={()=>{startMemoryGame(); setSelectedGame('card');}}><span style={{fontSize:'30px'}}>🃏</span><span>MEMORY</span></button><button className="game-card-btn" onClick={()=>{clickSound(); setSelectedGame('coin')}}><span style={{fontSize:'30px'}}>📀</span><span>COIN FLIP</span></button><button className="game-card-btn" onClick={()=>{clickSound(); setSelectedGame('slot')}}><span style={{fontSize:'30px'}}>🎰</span><span>SLOTS</span></button></div></>) : (<div className="game-stage"><button className="btn-menu" style={{marginBottom:'10px'}} onClick={()=>{clickSound(); setSelectedGame(null); setGameResultMsg('')}}>⬅ BACK</button>{selectedGame === 'slot' && (<div className="slot-machine-wrapper"><div className="slot-machine-bg" style={{backgroundImage: 'url(/assets/slot_machine.png)'}}><div className="reels-window">{slotReels.map((symbolIdx, i) => (<div key={i} className={`reel ${isSpinning?'blur':''}`}><img src={SLOT_SYMBOLS[symbolIdx].img} alt="s"/></div>))}</div><div className={`slot-handle ${isSpinning ? 'pulling' : ''}`}></div></div><div className="bet-controls"><input type="number" min="1" max={localFish} value={betAmount} onChange={(e)=>setBetAmount(Number(e.target.value))} /><button className={`btn-spin ${isSpinning?'disabled':''}`} onClick={playSlotMachine}>{isSpinning ? '...' : 'SPIN'}</button></div></div>)}{selectedGame === 'coin' && (<div className="coin-flip-container"><div className={`coin ${isFlipping ? 'flipping' : ''} ${coinSide}`}><div className="side heads">HEADS</div><div className="side tails">TAILS</div></div>{!isFlipping && <div className="bet-controls"><input type="number" min="1" max={localFish} value={betAmount} onChange={(e)=>setBetAmount(Number(e.target.value))} /><button className="btn-heads" style={{width:'80px'}} onClick={()=>playCoinFlip('heads')}>HEADS</button><button className="btn-tails" style={{width:'80px'}} onClick={()=>playCoinFlip('tails')}>TAILS</button></div>}</div>)}{selectedGame === 'card' && (<><div style={{marginBottom:10, fontSize:'16px'}}>⏳ {timer}s | {matchedCards.length/2}/6</div>{gameState === 'won' ? <h3 style={{color:'green', fontSize:'20px'}}>WIN +10🐟</h3> : <div className="card-grid">{cards.map((c,i)=>(<div key={i} className={`card ${flippedCards.includes(i)||matchedCards.includes(i)?'flipped':''}`} onClick={()=>handleCardClick(i)}><div className="card-inner"><div className="card-front">?</div><div className="card-back">{c.icon}</div></div></div>))}</div>}</>)}<div className="game-msg" style={{fontSize:'16px'}}>{gameResultMsg}</div></div>)}</div></div>}

        {activeTab === 'book' && <div className="minigame-overlay"><div className="book-container"><button className="btn-close" style={{top:'15px', right:'15px'}} onClick={()=>{clickSound(); setActiveTab(null)}}>X</button><div className="book-page"><h3>CATS</h3><div className="book-grid">{CAT_DB.map(c => { const isOwned = inventory.some(i => i.id === c.id); return (<div key={c.id} className={`book-item ${!isOwned ? 'locked' : ''}`} onClick={()=>{if(isOwned) {clickSound(); setBookDetailCat(c)}}}>{isOwned ? <div className="pixel-icon" style={{backgroundImage: `url(/assets/cat_${c.id}.png)`}}></div> : '?'}</div>) })}</div></div><div className="book-page"><h3>GEAR</h3><div className="book-grid" style={{color:'#3e2723', fontSize:'10px'}}>{GEAR_DB.map(a => (<div key={a.id} className="book-item" style={{flexDirection:'column'}}><span>{a.img}</span><span>{a.name}</span></div>))}</div></div></div></div>}

        {bookDetailCat && (
           <div className="minigame-overlay"><div className="book-container detail-view"><button className="btn-close" style={{top:'15px', right:'15px'}} onClick={()=>{clickSound(); setBookDetailCat(null)}}>X</button><div className="book-page left-page"><h3 style={{color: bookDetailCat.rarity==='SSR'?'gold':'#333', fontSize:'20px'}}>{bookDetailCat.name}</h3><div className="cat-portrait" style={{backgroundImage: `url(/assets/cat_${bookDetailCat.id}.png)`}}></div><div className="rarity-badge" style={{color: bookDetailCat.rarity==='SSR'?'gold':'#333'}}>{bookDetailCat.rarity} TIER</div></div><div className="book-page right-page"><h3>STATS</h3><div className="stat-row"><span>PERSONALITY:</span> <span>{bookDetailCat.personality}</span></div><div className="stat-desc">"{PERSONALITY_MAP[bookDetailCat.personality]?.desc}"</div><div style={{marginTop:'20px', border:'1px dashed #000', padding:'5px'}}><div>W: {PERSONALITY_MAP[bookDetailCat.personality].w}</div><div>C: {PERSONALITY_MAP[bookDetailCat.personality].c}</div><div>E: {PERSONALITY_MAP[bookDetailCat.personality].e}</div></div></div></div></div>
        )}

        {(pendingRewards.fish > 0.1 || pendingRewards.meow > 0) && (
            <div className="claim-box" onClick={claimRewards}><div className="claim-title">REWARDS</div><div>🐟 {pendingRewards.fish.toFixed(1)}</div>{pendingRewards.meow > 0 && <div>🐱 {pendingRewards.meow}</div>}<div className="claim-anim">CLAIM</div></div>
        )}

        {inventory.filter(item => equippedIds.includes(item.uuid)).map((cat) => {
             const moving = movingCats[cat.uuid]; const isHungry = cat.hunger <= 0;
             return (
             <div key={cat.uuid} className="cat-wrapper" style={{ left: `${catPos[cat.uuid]}%`, bottom: '-50%', top:'90%', zIndex: 50 }}>
                {isHungry && <div className="bubble-hungry">🍖</div>}
                {interactingCatId === cat.uuid && (
                    <div className="cat-think-panel">
                        <div style={{fontSize:'12px', textAlign:'center', color:'black', marginBottom:'5px', fontWeight:'bold'}}>Lv.{cat.level||1}</div>
                        <button onClick={()=>interact('feed', cat.uuid)}>Feed 5🐟</button>
                        <button onClick={()=>interact('pet', cat.uuid)}>Pet</button>
                        <button onClick={()=>interact('wander', cat.uuid)}>{moving ? 'Stop' : 'Wander'}</button>
                        <button style={{background:'#c62828'}} onClick={()=>{clickSound(); setInteractingCatId(null)}}>X</button>
                    </div>
                )}
                <div className={`cat-aura ${cat.rarity === 'SR' ? 'cat-sr' : ''} ${cat.rarity === 'SSR' ? 'cat-ssr' : ''}`} 
                onClick={() => {clickSound(); setInteractingCatId(interactingCatId === cat.uuid ? null : cat.uuid)}}> 
                    <div className={`Character ${moving ? 'is-moving' : 'is-idle'} ${(catDir[cat.uuid]||'right')==='right'?'face-right':'face-left'} `} style={{filter: isHungry ? 'grayscale(1)' : 'none'}}>
                        <img src={`/assets/cat_${cat.id}.png`} className="Character_spritesheet" alt="cat" />
                        {cat.equippedGear && <div style={{position:'absolute', top:'9px', left:'60%', fontSize:'7.5px', transform: 'translateX(-63%)'}}>{cat.equippedGear.img}
                        </div>}
                    </div>
                </div>
             </div>
        )})}
    </div>
  );
}

export default App;