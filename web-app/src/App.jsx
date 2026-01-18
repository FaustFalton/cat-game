import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect, useRef } from 'react';
import './App.css';
// ID CŨ CỦA BẠN (Không cần thay nếu chưa deploy lại)
const PACKAGE_ID = '0x3a4e4fcdf039350600b011605796f24ff07f02253c60cee98102d4b0e79129f1';
const GAME_STORE_ID = '0xb1171daae888321407a0c9d03b282a44c6a64d1d6cfa5360d3d4f5938d4ee0de';
const MODULE_NAME = 'cat_move';
  


const CAT_INFO = [
  { id: 0, name: 'Orange Cat', desc: 'Too much energy!' },
  { id: 1, name: 'Black Cat', desc: 'Brings mysterious luck.' },
  { id: 2, name: 'Siamese', desc: 'From Thailand with love.' },
  { id: 3, name: 'Calico', desc: 'Very rare and cute.' },
];

// FishingGame Component

function FishingGame( {onCatch} ) {
  const [isReelOut, setIsReelOut] = useState(false);
  const [baitPosition, setBaitPosition] = useState(0);
  const reelInterval = useRef(null);
  const gravityInterval = useRef(null);
  const [fishPosition, setFishPosition] = useState(40);
  const [progress, setProgress] = useState(0);
  const baitRef = useRef(null);
  const fishRef = useRef(null);
  const [isHolding, setIsHolding] = useState(false);
  
  useEffect(() => {
    const fishMove = setInterval(() => {
      setFishPosition(Math.random() * 30);
    }, 1200);
  
    return () => clearInterval(fishMove);
  }, []);

  useEffect(() => {
    const progressLoop = setInterval(() => {
      setProgress(prev => {
        if (!isHolding) {
          // KHÔNG HOLD → tụt
          return Math.max(prev - 1.5, 0);
        }
  
        // ĐANG HOLD
        if (isOverlapping()) {
          return Math.min(prev + 3, 100);
        }
  
        // HOLD nhưng không trúng cá
        return Math.max(prev - 3, 0);
      });
    }, 120);
  
    return () => clearInterval(progressLoop);
  }, [isHolding]);

  useEffect(() => {
    if (progress >= 100) {
      alert("🎣 You caught a fish!");
      onCatch && onCatch();   // 🔥 GỌI CALLBACK
    }
  }, [progress]);

  const isOverlapping = () => {
    if (!baitRef.current || !fishRef.current) return false;
  
    const bait = baitRef.current.getBoundingClientRect();
    const fish = fishRef.current.getBoundingClientRect();
  
    return !(
      bait.bottom < fish.top ||
      bait.top > fish.bottom
    );
  };
  
  const startReel = () => {
    clearInterval(gravityInterval.current);
    setIsReelOut(false);
  
    reelInterval.current = setInterval(() => {
      setBaitPosition(prev => Math.max(prev - 3, 0));
    }, 80);
  };
  const stopReel = () => {
    clearInterval(reelInterval.current);
    setIsReelOut(true);
  
    gravityInterval.current = setInterval(() => {
      setBaitPosition(prev => {
        if (prev >= 79) {
          clearInterval(gravityInterval.current);
          setIsReelOut(false);
          return 79;
        }
        return prev + 2;
      });
    }, 80);
  };

  const reelGravity = () => {
    setIsReelOut(true);
    setBaitPosition(79);

    setTimeout(() => {
      setIsReelOut(false);
    }, 1000); // Thời gian tương ứng với duration
  };

  useEffect(() => {
    reelGravity();
  }, []); // Chạy khi component được mount

  return (
    <div className="fishing">
    {/* CẦN CÂU */}
    <div className="rod"
    onMouseDown={() => {
      setIsHolding(true);
      startReel();
    }}
    onMouseUp={() => {
      setIsHolding(false);
      stopReel();
    }}
    onMouseLeave={() => {
      setIsHolding(false);
      stopReel();
    }}>
      
      <div className="reel">
        <div className={`handle ${isReelOut ? 'reelout' : ''}`}></div>
      </div>
    </div>

    {/* BIỂN + MỒI */}
    <div className="sea">
      <div className="area">
      <div  ref={fishRef} className="fish" style={{top: `${fishPosition}%`,transition: 'top 0.8s linear' }}>🐟</div>

        <div  ref={baitRef} className="bait"
          style={{
            top: `${baitPosition}%`,
            transition: 'top 1s linear',
          }}
        />
      </div>
    </div>

    {/* THANH TIẾN TRÌNH */}
    <div className="progress">
      <div className="area">
        <div className="bar" style={{ height: `${progress}%` }} />
      </div>
    </div>
  </div>
  );
}

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [cats, setCats] = useState([]);      
  const [basket, setBasket] = useState(null); 
  
  // State hiển thị Popup
  const [showShop, setShowShop] = useState(false);
  const [showMinigame, setShowMinigame] = useState(false); // <--- MỚI: State cho Minigame
  const [hoverDesc, setHoverDesc] = useState("");
  const [activeMinigame, setActiveMinigame] = useState(null);

  const [interactingCatId, setInteractingCatId] = useState(null); 
  const [catEffects, setCatEffects] = useState({}); 

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
        if (type?.includes(`${MODULE_NAME}::Cat`)) {
          myCats.push({ id: obj.data.objectId, breed: fields.breed });
        }
        if (type?.includes(`${MODULE_NAME}::FishBasket`)) {
          myBasket = { id: obj.data.objectId, amount: fields.amount };
        }
      });
      setCats(myCats);
      setBasket(myBasket);
    }
  }, [userObjects]);

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

  //khúc này sửa cho mèo default đứng yên thay vì chạy lung tung
  const [movingCats, setMovingCats] = useState({});
  const toggleMove = (catId) => {
    setMovingCats(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }));
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
        tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::feed_cat`, arguments: [tx.object(catId), tx.object(basket.id)] });
    } else if (action === 'pet') {
        tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::pet_cat`, arguments: [tx.object(catId), tx.object(basket.id)] });
    } else if (action === 'cut') {
        tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::cut_nails`, arguments: [tx.object(catId)] });
    }
    triggerEffect(catId, action === 'cut' ? 'sad' : 'happy');
    setInteractingCatId(null);
    executeTx(tx, () => console.log("Interaction Success"));
  };

  const triggerEffect = (catId, type) => {
    setCatEffects(prev => ({ ...prev, [catId]: type }));
    setTimeout(() => {
        setCatEffects(prev => {
            const newState = { ...prev };
            delete newState[catId];
            return newState;
        });
    }, type === 'sad' ? 5000 : 3000);
  };

  const rewardFish = () => {
    if (!basket) return;
  
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::add_fish`,
      arguments: [tx.object(basket.id)],
    });
  
    executeTx(tx, () => {
      alert("🐟 +1 Fish added to basket!");
      setActiveMinigame(null); // đóng fishing
    });
  };
  
  return (
    <div className="game-container">
      
      {/* --- TOP BAR (ĐÃ SỬA GIAO DIỆN) --- */}
      <div className="top-bar">
        {/* Góc trái: Shop & Minigame */}
        <div className="group-btn">
          <button className="btn-menu btn-shop" onClick={() => {setShowShop(true), setShowMinigame(false)}}>🛒 Shop</button>
          <button className="btn-menu btn-game" onClick={() => {setShowMinigame(true), setShowShop(false)}}>🎮 Minigame</button>
        </div>

        {/* Góc phải: Giỏ cá & Ví */}
        <div className="group-btn">
          {basket ? (
            // Hiển thị Giỏ cá đẹp hơn
            <div className="stat-box">
               🐟 {basket.amount}
            </div>
          ) : (
             account && <button className="btn-menu" style={{background: '#2e7d32'}} onClick={createBasket}>+ Get Basket</button>
          )}
          <ConnectButton />
        </div>
      </div>

      {/* --- POPUP SHOP --- */}
      {showShop && (
        <div className="pixel-panel center-popup">
          <h2 style={{marginTop: '40px',marginBottom: '-20px', color: 'white', textShadow: '2px 2px 10px black',}}>PET SHOP</h2>
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

      {/* --- POPUP MINIGAME (MỚI) --- */}
      {showMinigame && (
        <div className="minigame-panel center-popup" style={{width: '400px'}}>
           <h2 style={{marginTop: '15px',marginBottom: '26px', textAlign:'center',color:'white',textShadow:'2px 2px 13px black'}}>MINIGAME ZONE</h2>
           <h3 style={{marginTop: '50px',marginBottom: '25px', fontSize: '10.6px',height:'10px',textShadow:'3px 7px 10px black'}}>Obtain 🐟 with some minigames</h3>
           
           <div className='gamebutton' >
             <button className=" btn-game-fish">🃏 Card Flip</button>
             <button className="btn-game-fish" onClick={() => {setActiveMinigame('fishing'), setShowMinigame(false)}}>🎣 Catch Fish </button>
           </div>

           <button className="btn-action" onClick={() => setShowMinigame(false)}>Close</button>
        </div>
      )}
        {activeMinigame === 'fishing' && (
   <div className='center-popup' style={{ zIndex: 500 }}>
     <FishingGame onCatch={rewardFish} />

     <button
        className='btn-action'
      style={{ marginTop: '15px' }}
      onClick={() => setActiveMinigame(null)}
    >
      Exit Fishing
    </button>
  </div>
)}

    
      {/* --- RENDER MÈO --- */}
      {cats.map((cat, index) => {
        const effect = catEffects[cat.id];
        const randomDelay = { animationDelay: `-${index * 5}s` };

        return (
          <div key={cat.id}
          className={`cat-wrapper ${movingCats[cat.id] ? 'cat-moving' : ''}`}style={randomDelay}>
          {effect === 'happy' && <div className="heart-effect">❤️</div>}

          

            {interactingCatId === cat.id && (
              <div className="cat-think-panel"> 
               <div className="cat-bubble">
                   <button className="btn-bubble" onClick={() => toggleMove(cat.id)}>  {movingCats[cat.id] ? '▶ Sit' : '⏸ Wander'}</button>

            
                    <button className="btn-bubble" onClick={() => interact('feed', cat.id)}>🍖 Feed (1🐟)</button>
                    <button className="btn-bubble" onClick={() => interact('pet', cat.id)}>❤️ Pet (1🐟)</button>
                    <button className="btn-bubble" onClick={() => interact('cut', cat.id)}>✂️ Cut Nails</button>
                    <button className="btn-bubble btn-close-bubble" onClick={() => setInteractingCatId(null)}>Close</button>
                    </div>
                
   </div>
            )}
            <img 
              src={`/assets/cat_${cat.breed}.png`} 
              className={`cat-sprite ${effect === 'sad' ? 'cat-sad' : ''}`}
              onClick={() => setInteractingCatId(interactingCatId === cat.id ? null : cat.id)}
            />
          </div>
        )
      })}
    </div>
  );
}

export default App;