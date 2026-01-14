import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
// SỬA ĐỔI 1: Dùng Transaction từ thư viện mới
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import './App.css';

const PACKAGE_ID = '0x705e75cf2fd4792b569d66f7dbc12c978716aa0363a1604eccfc4af3a1753a27'; 
const MODULE_NAME = 'cat_game'; // Hoặc 'my_cat' tùy lúc bạn deploy

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [catObjectId, setCatObjectId] = useState(null);
  const [animation, setAnimation] = useState('idle');

  const { data: userObjects, refetch } = useSuiClientQuery('getOwnedObjects', {
    owner: account?.address,
    options: { showType: true }
  }, { enabled: !!account });

  useEffect(() => {
    if (userObjects?.data) {
      const foundCat = userObjects.data.find(obj => obj.data?.type?.includes(MODULE_NAME));
      if (foundCat) setCatObjectId(foundCat.data.objectId);
    }
  }, [userObjects]);

  const mintCat = () => {
    // SỬA ĐỔI 2: Dùng new Transaction()
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::mint_cat`,
      arguments: [tx.pure.string('Mimi')],
    });
    executeTx(tx, 'Mèo đã về ví của bạn!');
  };

  const interact = (action, animName) => {
    if (!catObjectId) return;
    setAnimation(animName);

    // SỬA ĐỔI 3: Dùng new Transaction()
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::${action}`,
      arguments: [tx.object(catObjectId)],
    });

    executeTx(tx, 'Thành công!');
    setTimeout(() => setAnimation('idle'), 2000);
  };

  const executeTx = (tx, successMsg) => {
    // SỬA ĐỔI 4: Tham số là 'transaction' (không phải transactionBlock)
    signAndExecute({ transaction: tx }, {
      onSuccess: () => {
        alert(successMsg);
        refetch();
      },
      onError: (err) => {
        console.error(err);
        setAnimation('idle');
        alert('Lỗi: ' + err.message);
      }
    });
  };

  return (
    <div className="container">
      <nav>
        <h1>Sui Cat Game 🐱</h1>
        <ConnectButton />
      </nav>

      <div className="game-area">
        {!account ? (
          <p>Vui lòng kết nối ví để chơi!</p>
        ) : !catObjectId ? (
          <button className="btn-mint" onClick={mintCat}>Tạo Mèo Mới (Mint NFT)</button>
        ) : (
          <>
            <div className="cat-stage">
                {animation === 'idle' && <img src="/assets/cat_idle.png" className="cat-img floating" />}
                {animation === 'eat' && <img src="/assets/cat_eat.png" className="cat-img" />}
                {animation === 'happy' && <img src="/assets/cat_happy.png" className="cat-img" />}
                {animation === 'scared' && <img src="/assets/cat_scared.png" className="cat-img" />}
            </div>

            <div className="controls">
              <button onClick={() => interact('feed', 'eat')}>🍖 Cho ăn</button>
              <button onClick={() => interact('play', 'happy')}>❤️ Cưng nựng</button>
              <button onClick={() => interact('clean_litter', 'happy')}>🧹 Dọn cát</button>
              <button onClick={() => interact('cut_nails', 'scared')}>✂️ Cắt móng</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;