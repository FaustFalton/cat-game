import { 
  ConnectButton, 
  useCurrentAccount, 
  useSignAndExecuteTransaction, 
  useSuiClientQuery 
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import * as snarkjs from "snarkjs";
import { PACKAGE_ID, MODULE_NAME } from './constants';
import './App.css';

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [isWalking, setIsWalking] = useState(false);
  const [steps, setSteps] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Lấy PlayerData từ blockchain
  const { data: ownedObjects, refetch } = useSuiClientQuery('getOwnedObjects', {
    owner: account?.address as string,
    filter: { StructType: `${PACKAGE_ID}::${MODULE_NAME}::PlayerData` },
    options: { showContent: true }
  });

  const playerData = ownedObjects?.data?.[0]?.data;
  const playerDataId = playerData?.objectId;

  // 1. Hàm Đăng ký người chơi
  const registerUser = async () => {
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::register_user`,
      arguments: [],
    });
    signAndExecute({ transaction: txb }, { onSuccess: () => { alert("Welcome to SuiGochi!"); refetch(); } });
  };

  // 2. HÀM TẠO ZK PROOF & GỬI LÊN SUI
  const handleClaimZkFish = async () => {
    if (!playerDataId) return;
    setIsGenerating(true);

    try {
      //TẠO PROOF TRÊN TRÌNH DUYỆT 
      console.log("Đang tính toán ma trận ZK...");
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        { actual_steps: 5000, threshold: 5000 },
        "/zk/step_verifier.wasm",
        "/zk/step_verifier_0000.zkey"
      );

      //ĐỌC VERIFICATION KEY
      const vKeyRes = await fetch("/zk/verification_key.json");
      const vKey = await vKeyRes.json();

      //CHUYỂN DỮ LIỆU SANG BYTE ĐỂ SUI MOVE CÓ THỂ ĐỌC
      const encoder = new TextEncoder();
      const vkBytes = encoder.encode(JSON.stringify(vKey));
      const inputBytes = encoder.encode(JSON.stringify(publicSignals));
      const proofBytes = encoder.encode(JSON.stringify(proof));

      //GỌI SMART CONTRACT TRÊN SUI
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::claim_fish_with_walk`,
        arguments: [
          txb.object(playerDataId),
          txb.pure.vector('u8', Array.from(vkBytes)),
          txb.pure.vector('u8', Array.from(inputBytes)),
          txb.pure.vector('u8', Array.from(proofBytes)),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          alert("Sui Verified! Bằng chứng hợp lệ. Bạn nhận được 500 Cá 🐟");
          setIsWalking(false);
          setSteps(0);
          refetch();
        },
        onError: (err) => alert("Lỗi Verify on-chain: " + err.message)
      });
    } catch (e) {
      console.error(e);
      alert("Lỗi tạo Proof. Hãy kiểm tra Console để xem chi tiết.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Logic đếm bước chân giả lập
  useEffect(() => {
    let t: any;
    if (isWalking && steps < 5000) t = setInterval(() => setSteps(s => s + 250), 100);
    return () => clearInterval(t);
  }, [isWalking, steps]);

  return (
    <div className="game-container">
      <div className="top-bar">
        <div className="group-btn">
          <button className="pixel-btn" onClick={() => window.location.reload()}>RELOAD</button>
          <ConnectButton />
        </div>
        <div className="stat-box fish-token">
          🐟 {playerData ? (playerData.content as any).fields.fish_balance : 0}
        </div>
      </div>

      <div className="main-stage" style={{marginTop:'150px', textAlign:'center'}}>
        {!account ? (
           <h2 style={{color:'white', textShadow: '2px 2px 0 #000'}}>KẾT NỐI VÍ ĐỂ CHƠI</h2>
        ) : !playerDataId ? (
           <button className="btn-action" onClick={registerUser}>BẮT ĐẦU CHƠI (REGISTER)</button>
        ) : (
          <>
            <img src="/assets/cat_0.png" className="pet-sprite" style={{width:'150px'}} />
            <br/>
            <button className="pixel-btn" style={{background:'#4caf50', marginTop:'20px', fontSize: '14px'}} onClick={() => {setIsWalking(true); setSteps(0)}}>
              🌲 ĐI BỘ KIẾM CÁ (ZK WALK)
            </button>
          </>
        )}
      </div>

      {isWalking && (
        <div className="minigame-overlay">
          <div className="pixel-panel" style={{width:'450px'}}>
            <h2 style={{color: 'gold'}}>CÔNG VIÊN SUI</h2>
            <div style={{fontSize:'35px', margin:'20px'}}>🏃‍♂️ {steps} / 5000</div>
            <div className="pixel-bar-bg" style={{height:'25px', background:'#000', border: '2px solid #fff'}}>
               <div style={{width:`${(steps/5000)*100}%`, height:'100%', background:'#4caf50'}}></div>
            </div>
            
            {steps >= 5000 && (
              <button className="btn-action" style={{background:'gold', color:'black', marginTop:'25px'}} onClick={handleClaimZkFish} disabled={isGenerating}>
                {isGenerating ? "ĐANG TÍNH TOÁN ZK PROOF..." : "XÁC THỰC ZK & NHẬN THƯỞNG"}
              </button>
            )}
            <button className="pixel-btn" style={{marginTop:'20px', background:'#f44336'}} onClick={()=>setIsWalking(false)}>THOÁT</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;