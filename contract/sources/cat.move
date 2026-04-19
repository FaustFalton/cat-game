module 0x0::cat_move {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use std::vector;
    use std::string::{Self, String};
    use sui::event;

    // --- IMPORT ZK MODULE ---
    use sui::groth16; 

    // --- CONFIG ---
    const FISH_PER_SUI: u64 = 50; 
    const BLIND_BOX_COST: u64 = 160;
    const ZK_WALK_REWARD: u64 = 500; // Thưởng 500 cá cho mỗi lần verify đi bộ thành công

    // --- ERRORS ---
    const E_NOT_ENOUGH_FISH: u64 = 1;
    const E_INVALID_PROOF: u64 = 999;

    // --- EVENTS ---
    struct FishClaimed has copy, drop {
        player: address,
        amount: u64
    }

    struct GameStore has key { 
        id: UID, 
        profits: Balance<SUI>,
    }
    
    struct Cat has key, store { 
        id: UID, 
        name: String, 
        breed: u8, 
        rarity: u8, 
        hunger: u64, 
        level: u64,
        total_steps: u64
    }

    struct PlayerData has key, store { 
        id: UID, 
        fish_balance: u64,
        pity_counter: u64,
    }

    fun init(ctx: &mut TxContext) {
        let shop = GameStore { 
            id: object::new(ctx), 
            profits: balance::zero(),
        };
        transfer::share_object(shop);
    }

    public entry fun register_user(ctx: &mut TxContext) {
        let player = PlayerData {
            id: object::new(ctx), 
            fish_balance: 50,
            pity_counter: 0,
        };
        let starter_cat = Cat { 
            id: object::new(ctx), name: string::utf8(b"Starter Meow"), breed: 0, rarity: 1, 
            hunger: 100, level: 1, total_steps: 0
        };
        transfer::transfer(player, tx_context::sender(ctx));
        transfer::public_transfer(starter_cat, tx_context::sender(ctx));
    }

    // --- ZK WALKING MINIGAME: CLAIM FISH BY STEPS ---
    // Đây là hàm mới tích hợp ZK
    public entry fun claim_fish_with_walk(
        player_data: &mut PlayerData,
        vk_bytes: vector<u8>,       // Verification Key (từ Bước 1 Circom)
        public_inputs: vector<u8>,  // Ngưỡng đi bộ (ví dụ: 5000 bước)
        proof_bytes: vector<u8>,    // Bằng chứng bí mật từ Frontend
        ctx: &mut TxContext
    ) {
        let curve = groth16::bn254(); 

        // 1. Verify ZK Proof
        let vk = groth16::prepare_verifying_key(&curve, &vk_bytes);
        let public_inputs_struct = groth16::public_proof_inputs_from_bytes(public_inputs);
        let proof_points_struct = groth16::proof_points_from_bytes(proof_bytes);

        let is_valid = groth16::verify_groth16_proof(
            &curve,
            &vk,
            &public_inputs_struct,
            &proof_points_struct
        );

        // 2. Nếu bằng chứng đúng -> Tặng cá cho Player
        assert!(is_valid, E_INVALID_PROOF); 

        player_data.fish_balance = player_data.fish_balance + ZK_WALK_REWARD;

        event::emit(FishClaimed {
            player: tx_context::sender(ctx),
            amount: ZK_WALK_REWARD
        });
    }

    // --- GIỮ NGUYÊN CÁC HÀM CŨ (GACHA, BUY FISH...) ---
    public entry fun buy_fish(shop: &mut GameStore, player: &mut PlayerData, payment: Coin<SUI>) {
        let value = coin::value(&payment);
        let fish_amount = (value * FISH_PER_SUI) / 1000000000; 
        balance::join(&mut shop.profits, coin::into_balance(payment));
        player.fish_balance = player.fish_balance + fish_amount;
    }

    public entry fun open_blind_box(player: &mut PlayerData, amount: u64, ctx: &mut TxContext) {
        let cost = amount * BLIND_BOX_COST;
        assert!(player.fish_balance >= cost, E_NOT_ENOUGH_FISH);
        player.fish_balance = player.fish_balance - cost;

        let mut_i = 0; 
        while (mut_i < amount) {
            player.pity_counter = player.pity_counter + 1;
            let roll = random(ctx, 100);
            let rarity; 
            if (player.pity_counter >= 60) { rarity = 3; player.pity_counter = 0; }
            else {
                if (roll < 1) { rarity = 3; player.pity_counter = 0; } 
                else if (roll < 6) { rarity = 2; } 
                else { rarity = 1; } 
            };
            let breed = random(ctx, 4); 
            let cat = Cat { 
                id: object::new(ctx), name: string::utf8(b"BlindBox Cat"), breed: (breed as u8), rarity, 
                hunger: 100, level: 1, total_steps: 0 
            };
            transfer::public_transfer(cat, tx_context::sender(ctx));
            mut_i = mut_i + 1;
        };
    }

    fun random(ctx: &mut TxContext, max: u64): u64 {
        let uid = object::new(ctx);
        let id_bytes = object::uid_to_bytes(&uid);
        let first_byte = *vector::borrow(&id_bytes, 0);
        object::delete(uid);
        (first_byte as u64) % max
    }
}