import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import './App.css';

const PACKAGE_ID = '0x3a4e4fcdf039350600b011605796f24ff07f02253c60cee98102d4b0e79129f1';
const GAME_STORE_ID = '0xb1171daae888321407a0c9d03b282a44c6a64d1d6cfa5360d3d4f5938d4ee0de'; 
const MODULE_NAME = 'cat_move';

const CAT_INFO = [
  { id: 0, name: 'Orange Cat', desc: 'Too much energy!' },
  { id: 1, name: 'Black Cat', desc: 'Brings mysterious luck.' },
  { id: 2, name: 'Siamese', desc: 'From Thailand with love.' },
  { id: 3, name: 'Calico', desc: 'Very rare and cute.' },
];

const CARD_ICONS = ['🐟', '🦴', '🐭', '🦀', '🧶', '🐱'];

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Data State
  const [cats, setCats] = useState([]);      
  const [basket, setBasket] = useState(null); 
  
  // UI State
  const [showShop, setShowShop] = useState(false);
  const [showMinigame, setShowMinigame] = useState(false); 
  const [hoverDesc, setHoverDesc] = useState("");
  const [interactingCatId, setInteractingCatId] = useState(null); 
  const [catEffects, setCatEffects] = useState({}); 
  //chỉnh cho mèo đi
  const [catPos, setCatPos] = useState({});
  const [catDir, setCatDir] = useState({});

  // Drag State
  const [catPositions, setCatPositions] = useState({}); 
  const [isDragging, setIsDragging] = useState(false);  
  const [dragCatId, setDragCatId] = useState(null);     
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); 
  const [movingCats, setMovingCats] = useState({});

  // Minigame State
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedCards, setMatchedCards] = useState([]);
  const [gameWon, setGameWon] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameOver, setGameOver] = useState(false);

  const { data: userObjects, refetch } = useSuiClientQuery('getOwnedObjects', {
    owner: account?.address,
    options: { showType: true, showContent: true }
  }, { enabled: !!account });

  useEffect(() => {
    if (userObjects?.data) {
      const myCats = [];
      let myBasket = null;
      userObjects.data.forEach(obj => {
        const type = obj.data?.type;
        const fields = obj.data?.content?.fields;
        if (type?.includes(`${PACKAGE_ID}::${MODULE_NAME}::Cat`)) {
          myCats.push({ id: obj.data.objectId, breed: fields.breed });
        }
        if (type?.includes(`${PACKAGE_ID}::${MODULE_NAME}::FishBasket`)) {
          myBasket = { id: obj.data.objectId, amount: fields.amount };
        }
      });
      setCats(myCats);
      setBasket(myBasket);
    }
  }, [userObjects]);

  // Timer logic
  useEffect(() => {
    let timer;
    if (showMinigame && !gameWon && !gameOver && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setGameOver(true);
    }
    return () => clearInterval(timer);
  }, [showMinigame, timeLeft, gameWon, gameOver]);

  const startCardGame = () => {
    const shuffledIcons = [...CARD_ICONS, ...CARD_ICONS].sort(() => Math.random() - 0.5);
    const newCards = shuffledIcons.map((icon, index) => ({ id: index, icon: icon }));
    setCards(newCards);
    setFlippedCards([]);
    setMatchedCards([]);
    setGameWon(false);
    setGameOver(false);
    setTimeLeft(120);
    setIsProcessing(false);
  };

  const handleCardClick = (id) => {
    if (isProcessing || gameWon || gameOver || matchedCards.includes(id) || flippedCards.includes(id)) return;

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setIsProcessing(true);
      const [firstId, secondId] = newFlipped;
      if (cards[firstId].icon === cards[secondId].icon) {
        setMatchedCards(prev => [...prev, firstId, secondId]);
        setFlippedCards([]);
        setIsProcessing(false);
      } else {
        setTimeout(() => {
          setFlippedCards([]);
          setIsProcessing(false);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && matchedCards.length === cards.length) {
      setGameWon(true);
    }
  }, [matchedCards]);

  const claimReward = () => {
    if (!basket) return alert("You need a Fish Basket first!");
    const tx = new Transaction();
    for (let i = 0; i < 5; i++) {
        tx.moveCall({ 
            target: `${PACKAGE_ID}::${MODULE_NAME}::reward_fish`, 
            arguments: [tx.object(basket.id)] 
        });
    }
    executeTx(tx, () => {
      alert("You received 5 Fish! 🐟🐟🐟🐟🐟");
      setShowMinigame(false);
    });
  };

  const executeTx = (tx, onSuccess) => {
    signAndExecute({ transaction: tx }, {
      onSuccess: () => { refetch(); onSuccess && onSuccess(); },
      onError: (err) => alert("Error: " + err.message)
    });
  };

  const buyCat = (breedId) => {
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100000000)]); 
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::buy_cat`,
      arguments: [tx.object(GAME_STORE_ID), coin, tx.pure.u8(breedId), tx.pure.string('Meow')],
    });
    executeTx(tx, () => { alert("Welcome new cat!"); setShowShop(false); });
  };

  const toggleMove = (catId) => {
    setMovingCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const createBasket = () => {
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::create_basket`, arguments: [] });
    executeTx(tx, () => alert("Received Basket!"));
  };

  const interact = (action, catId) => {
    if ((action === 'feed' || action === 'pet') && (!basket || basket.amount <= 0)) {
      return alert("No fish left! Need to catch more.");
    }
  
    const tx = new Transaction();
  
    if (action === 'feed') {
      tx.moveCall({target: `${PACKAGE_ID}::${MODULE_NAME}::feed_cat`, arguments: [tx.object(catId), tx.object(basket.id)],});
   
    } else if (action === 'pet') {
      tx.moveCall({target: `${PACKAGE_ID}::${MODULE_NAME}::pet_cat`, arguments: [tx.object(catId), tx.object(basket.id)],});
    
    } else if (action === 'cut') {
      tx.moveCall({target: `${PACKAGE_ID}::${MODULE_NAME}::cut_nails`, arguments: [tx.object(catId)],});
    }
  
    triggerEffect(catId, action === 'cut' ? 'sad' : 'happy');
    executeTx(tx, () => {
      console.log("Interaction Success");
  
      setTimeout(() => {
        setInteractingCatId(null);
      }, action === 'cut' ? 1500 : 1200);
    });
  };
  // Set speed cho mèo đi
  useEffect(() => {
    const interval = setInterval(() => {setCatPos(prev => {
    const next = { ...prev };
  
     Object.keys(movingCats).forEach(catId => {
          if (!movingCats[catId]) return;
  
          const dir = catDir[catId];
          let x = prev[catId] ?? 100;
  
          const SPEED = 3.5;
          const LEFT_LIMIT = 20;
          const RIGHT_LIMIT = window.innerWidth - 120;
  
          if (dir === 'right') {
            x += SPEED;
           
            if (x >= RIGHT_LIMIT) {
             
              x = RIGHT_LIMIT;
              setCatDir(d => ({ ...d, [catId]: 'left' }));
            }
          } else {
            x -= SPEED;
            if (x <= LEFT_LIMIT) {
              x = LEFT_LIMIT;
              setCatDir(d => ({ ...d, [catId]: 'right' }));
            }
          }
  
          next[catId] = x;
        });
  
        return next;
      });
    }, 30);
  
    return () => clearInterval(interval);
  }, [movingCats, catDir]);

  const triggerEffect = (catId, type) => {
    setCatEffects(prev => ({ ...prev, [catId]: type }));
    setTimeout(() => setCatEffects(prev => { const n = { ...prev }; delete n[catId]; return n; }), type === 'sad' ? 5000 : 3000);
  };

  const handleMouseDown = (e, catId) => {
    if (interactingCatId === catId) return;
    setMovingCats(prev => ({ ...prev, [catId]: false }));
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragCatId(catId);
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || dragCatId === null) return;
    const containerRect = e.currentTarget.getBoundingClientRect();
    setCatPositions(prev => ({
      ...prev,
      [dragCatId]: { x: e.clientX - containerRect.left - dragOffset.x, y: e.clientY - containerRect.top - dragOffset.y }
    }));
  };

  const handleMouseUp = () => { setIsDragging(false); setDragCatId(null); };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="game-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      
      {/* MINIGAME FULL SCREEN */}
      {showMinigame && (
        <div className="minigame-overlay">
           
           <button className="btn-quit-game" onClick={() => setShowMinigame(false)}>❌ QUIT</button>

           <div className="game-hud">
              <div className="hud-box">⏳ {formatTime(timeLeft)}</div>
              <div className="hud-box">⭐ Score: {matchedCards.length / 2}/6</div>
           </div>

           {gameWon || gameOver ? (
             <div className="result-screen" style={{width: '400px'}}>
               <h1 className="result-title">{gameWon ? "YOU WON!" : "TIME OVER!"}</h1>
               <p style={{marginBottom: '30px', color: '#5d4037'}}>{gameWon ? "Amazing!" : "Try again."}</p>
               {gameWon && <button className="btn-large btn-claim" onClick={claimReward}>🎁 Claim 5 Fish</button>}
               <button className="btn-large btn-restart" onClick={startCardGame}>🔄 Replay</button>
               <button className="btn-large btn-exit" onClick={() => setShowMinigame(false)}>🚪 Exit</button>
             </div>
           ) : (
             <div className="card-grid">
               {cards.map((card) => {
                 const isFlipped = flippedCards.includes(card.id) || matchedCards.includes(card.id);
                 return (
                   <div key={card.id} className={`card ${isFlipped ? 'flipped' : ''}`} onClick={() => handleCardClick(card.id)}>
                     <div className="card-inner">
                       <div className="card-front">?</div> 
                       <div className="card-back">{card.icon}</div>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}
        </div>
        
      )}

      {/* MAIN GAME */}
      <div style={{display: showMinigame ? 'none' : 'block'}}>
        <div className="top-bar">
          <div className="group-btn">
            <button className="btn-menu btn-shop" onClick={() => setShowShop(true)}>🛒 Shop</button>
            <button className="btn-menu btn-game" onClick={() => {setShowMinigame(true); startCardGame();}}>🎮 Minigame</button>
          </div>
          <div className="group-btn">
            {basket ? <div className="stat-box">🐟 {basket.amount}</div> : account && <button className="btn-menu" style={{background: '#2e7d32'}} onClick={createBasket}>+ Get Basket</button>}
            <ConnectButton />
          </div>
        </div>

        {showShop && (
          <div className="pixel-panel center-popup">
            <h2 style={{marginTop: '40px',marginBottom: '-20px', color: 'white', textShadow: '2px 2px 10px black'}}>PET SHOP</h2>
            <div className="shop-grid">
              {CAT_INFO.map((cat) => (
                <div key={cat.id} className="shop-item" onClick={() => buyCat(cat.id)} onMouseEnter={() => setHoverDesc(cat.desc)} onMouseLeave={() => setHoverDesc("")}>
                  <img src={`/assets/cat_${cat.id}.png`} width="80" />
                  <div className="price-tag">0.1 SUI</div>
                </div>
              ))}
            </div>
            <div className="description-box">{hoverDesc || "Choose a friend..."}</div>
            <button className="btn-action" onClick={() => setShowShop(false)}>Close</button>
          </div>
        )}
        
        {/* --- RENDER MÈO --- */}
        {cats.map((cat, index) => {
        const effect = catEffects[cat.id];
         const dir = catDir[cat.id] || 'right';
        const moving = movingCats[cat.id];

        return (
          <div key={cat.id} className="cat-wrapper" style={{
            left: catPos[cat.id] ?? 100,
            bottom: '25%',
            position: 'absolute',}} >

          {/* === POPUP (KHÔNG BỊ TRANSFORM) === */}
          {interactingCatId === cat.id && (
            <div className="cat-think-panel">
              <div className="cat-bubble">
                <button className="btn-bubble" onClick={() => toggleMove(cat.id)}> {movingCats[cat.id] ? '▶ Sit' : '⏸ Wander'}</button>
                <button className="btn-bubble" onClick={() => interact('feed', cat.id)}> 🍖 Feed (1🐟)</button>
                <button className="btn-bubble" onClick={() => interact('pet', cat.id)}> ❤️ Pet (1🐟)</button>
                <button className="btn-bubble" onClick={() => interact('cut', cat.id)}>✂️ Cut Nails</button>
                <button className="btn-bubble btn-close-bubble" onClick={() => setInteractingCatId(null)}> Close </button>
              </div>
            </div>
          )}
        
          {/* === MÈO (CÓ TRANSFORM) === */}
          {effect === 'happy' && <div className="heart-effect">❤️</div>}
        
          <div className={`Character ${moving ? 'is-moving' : 'is-idle'} ${ dir === 'right' ? 'face-right' : 'face-left' }`}>
           
          <img src={`/assets/cat_${cat.breed}.png`} 
          className={`Character_spritesheet pixelart ${effect === 'sad' ? 'cat-sad' : '' }`}
             
             onClick={() => setInteractingCatId(interactingCatId === cat.id ? null : cat.id) } />
          </div>
        </div>  
         );
        })}
      </div>
      </div>
  );
}
export default App;