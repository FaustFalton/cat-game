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
    // 1 SUI (10^9 Mist) buys 100 fish. 
    // Rate = 100 fish / 1,000,000,000 mist.
    // Calculation: (Input Mist / 10,000,000) = Fish amount? No, that's complex.
    // Simpler: If user sends 1 SUI (10^9), they get 100 fish.
    // So 1 Fish = 10,000,000 Mist.
    const FISH_PER_SUI: u64 = 100; 

    const GACHA_COST_SINGLE: u64 = 16;
    const GACHA_COST_MULTI: u64 = 160;
    
    // --- ERRORS ---
    const E_NOT_ENOUGH_FISH: u64 = 1;
    const E_ALREADY_CLAIMED_DAILY: u64 = 2;

    struct GameStore has key { id: UID, profits: Balance<SUI> }
    
    struct Cat has key, store { 
        id: UID, name: vector<u8>, breed: u8, rarity: u8, 
        hunger: u64, happiness: u64 
    }

    struct PlayerData has key { 
        id: UID, 
        fish: u64,
        pity_counter: u64, 
        last_login: u64,   
        login_streak: u64
    }

    fun init(ctx: &mut TxContext) {
        let shop = GameStore { id: object::new(ctx), profits: balance::zero() };
        transfer::share_object(shop);
    }

    public entry fun register_user(ctx: &mut TxContext) {
        let player = PlayerData {
            id: object::new(ctx), fish: 10, pity_counter: 0, 
            last_login: 0, login_streak: 0
        };
        // Give starter cat
        let starter_cat = Cat { 
            id: object::new(ctx), name: b"Starter Meow", breed: 0, rarity: 1, 
            hunger: 50, happiness: 50 
        };
        transfer::transfer(player, tx_context::sender(ctx));
        transfer::public_transfer(starter_cat, tx_context::sender(ctx));
    }

    // --- DAILY LOGIN ---
    public entry fun daily_checkin(player: &mut PlayerData, clock: &Clock, _ctx: &mut TxContext) {
        let now = clock::timestamp_ms(clock);
        let one_day = 86400000;
        assert!(now > player.last_login + one_day || player.last_login == 0, E_ALREADY_CLAIMED_DAILY);
        
        player.last_login = now;
        player.login_streak = player.login_streak + 1;
        let reward = if (player.login_streak % 7 == 0) { 20 } else { 5 };
        player.fish = player.fish + reward;
    }

    // Buy Fish Logic Updated
    public entry fun buy_fish(shop: &mut GameStore, player: &mut PlayerData, payment: Coin<SUI>) {
        let value = coin::value(&payment);
        // 1 SUI (1_000_000_000) -> 100 Fish.
        // So Fish = Value / 10_000_000.
        let fish_amount = value / 10000000; 
        
        balance::join(&mut shop.profits, coin::into_balance(payment));
        player.fish = player.fish + fish_amount;
    }

    // --- HELPER RANDOM ---
    fun random(ctx: &mut TxContext, max: u64): u64 {
        let uid = object::new(ctx);
        let id_bytes = object::uid_to_bytes(&uid);
        let first_byte = *vector::borrow(&id_bytes, 0);
        object::delete(uid);
        (first_byte as u64) % max
    }

    // --- MINIGAME SYSTEM ---
    
    // Coin Flip: Bet X, Win 2X
    public entry fun play_coin_flip(player: &mut PlayerData, bet: u64, choice: u64, ctx: &mut TxContext) {
        assert!(player.fish >= bet, E_NOT_ENOUGH_FISH);
        player.fish = player.fish - bet; 

        let result = random(ctx, 2); // 0 or 1
        if (result == choice) {
            player.fish = player.fish + (bet * 2); 
        }
    }

    // Slots: Bet X, Win 5X or X+1
    public entry fun play_slots(player: &mut PlayerData, bet: u64, ctx: &mut TxContext) {
        assert!(player.fish >= bet, E_NOT_ENOUGH_FISH);
        player.fish = player.fish - bet;

        let s1 = random(ctx, 3);
        let s2 = random(ctx, 3); 
        let s3 = random(ctx, 3); 

        if (s1 == s2 && s2 == s3) {
            player.fish = player.fish + (bet * 5);
        } else if (s1 == s2 || s2 == s3 || s1 == s3) {
            player.fish = player.fish + (bet + 1); 
        }
    }
    
    // Memory Game Reward
    public entry fun claim_memory_reward(player: &mut PlayerData) {
         player.fish = player.fish + 5;
    }

    // --- GACHA & INTERACTION ---
    public entry fun gacha_pull(player: &mut PlayerData, amount: u64, ctx: &mut TxContext) {
        let cost = if (amount == 10) { GACHA_COST_MULTI } else { GACHA_COST_SINGLE };
        assert!(player.fish >= cost, E_NOT_ENOUGH_FISH);
        player.fish = player.fish - cost;

        let mut_i = 0; 
        while (mut_i < amount) {
            player.pity_counter = player.pity_counter + 1;
            let roll = random(ctx, 100);
            
            let rarity; 
            if (player.pity_counter >= 60) { rarity = 3; player.pity_counter = 0; }
            else if (amount == 10 && mut_i == 9) { rarity = 2; }
            else {
                if (roll < 5) { rarity = 3; player.pity_counter = 0; }
                else if (roll < 30) { rarity = 2; }
                else { rarity = 1; }
            };

            let breed;
            if (rarity == 1) { breed = random(ctx, 2); } 
            else if (rarity == 2) { breed = 2 + random(ctx, 2); } 
            else { breed = 4 + random(ctx, 2); };

            let cat = Cat { 
                id: object::new(ctx), name: b"Gacha Cat", breed: (breed as u8), rarity, 
                hunger: 50, happiness: 50 
            };
            transfer::public_transfer(cat, tx_context::sender(ctx));
            
            mut_i = mut_i + 1;
        };
    }

    public entry fun feed_cat(cat: &mut Cat, player: &mut PlayerData) {
        if (player.fish > 0) { player.fish = player.fish - 1; cat.hunger = 0; }
    }
    public entry fun pet_cat(cat: &mut Cat, player: &mut PlayerData) {
        if (player.fish > 0) { player.fish = player.fish - 1; cat.happiness = 100; }
    }
    public entry fun cut_nails(cat: &mut Cat) { cat.happiness = 0; }
}