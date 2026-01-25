module 0x0::cat_move {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use std::vector;

    // --- CONFIG ---
    // 1 SUI = 50 FISH
    const FISH_PER_SUI: u64 = 50; 
    const BLIND_BOX_COST: u64 = 160;
    
    // --- ERRORS ---
    const E_NOT_ENOUGH_FISH: u64 = 1;
    const E_ALREADY_CLAIMED_DAILY: u64 = 2;

    // --- TOKENS ---
    // MEOW: Governance Token (Fixed Supply simulation)
    struct MEOW has drop {}
    // FISH: In-game Currency
    struct FISH has drop {}

    struct GameStore has key { 
        id: UID, 
        profits: Balance<SUI>,
        meow_pool: Balance<MEOW> // Giả lập pool thưởng
    }
    
    struct Cat has key, store { 
        id: UID, 
        name: vector<u8>, 
        breed: u8, 
        rarity: u8, // 1: R, 2: SR, 3: SSR
        hunger: u64, // Max 100
        last_claim: u64 
    }

    struct PlayerData has key { 
        id: UID, 
        fish_balance: u64,
        meow_balance: u64,
        pity_counter: u64, 
        last_login: u64,   
        login_streak: u64
    }

    fun init(ctx: &mut TxContext) {
        let shop = GameStore { 
            id: object::new(ctx), 
            profits: balance::zero(),
            meow_pool: balance::zero() // Cần logic mint MEOW thật ở đây
        };
        transfer::share_object(shop);
    }

    public entry fun register_user(ctx: &mut TxContext) {
        let player = PlayerData {
            id: object::new(ctx), 
            fish_balance: 50, // Starter fish
            meow_balance: 0,
            pity_counter: 0, 
            last_login: 0, login_streak: 0
        };
        // Starter Cat (Rarity 1)
        let starter_cat = Cat { 
            id: object::new(ctx), name: b"Starter Meow", breed: 0, rarity: 1, 
            hunger: 100, last_claim: 0
        };
        transfer::transfer(player, tx_context::sender(ctx));
        transfer::public_transfer(starter_cat, tx_context::sender(ctx));
    }

    // --- EXCHANGE: SUI -> FISH ---
    public entry fun buy_fish(shop: &mut GameStore, player: &mut PlayerData, payment: Coin<SUI>) {
        let value = coin::value(&payment);
        // 1 SUI (10^9 Mist) = 50 Fish.
        // Formula: (Value * 50) / 10^9
        let fish_amount = (value * FISH_PER_SUI) / 1000000000; 
        
        balance::join(&mut shop.profits, coin::into_balance(payment));
        player.fish_balance = player.fish_balance + fish_amount;
    }

    // --- BLIND BOX (GACHA) ---
    public entry fun open_blind_box(player: &mut PlayerData, amount: u64, ctx: &mut TxContext) {
        let cost = amount * BLIND_BOX_COST;
        assert!(player.fish_balance >= cost, E_NOT_ENOUGH_FISH);
        player.fish_balance = player.fish_balance - cost;

        let mut_i = 0; 
        while (mut_i < amount) {
            player.pity_counter = player.pity_counter + 1;
            let roll = random(ctx, 100);
            
            let rarity; 
            // SSR Logic
            if (player.pity_counter >= 60) { rarity = 3; player.pity_counter = 0; }
            else {
                if (roll < 1) { rarity = 3; player.pity_counter = 0; } // 1% SSR
                else if (roll < 6) { rarity = 2; } // 5% SR
                else { rarity = 1; } // R
            };

            let breed = random(ctx, 4); // Random visual breed

            let cat = Cat { 
                id: object::new(ctx), name: b"BlindBox Cat", breed: (breed as u8), rarity, 
                hunger: 100, last_claim: 0 
            };
            transfer::public_transfer(cat, tx_context::sender(ctx));
            mut_i = mut_i + 1;
        };
    }

    // --- HELPER RANDOM ---
    fun random(ctx: &mut TxContext, max: u64): u64 {
        let uid = object::new(ctx);
        let id_bytes = object::uid_to_bytes(&uid);
        let first_byte = *vector::borrow(&id_bytes, 0);
        object::delete(uid);
        (first_byte as u64) % max
    }
}