module contract::cat_game {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    
    // -- Cấu trúc con mèo (NFT) --
    struct Cat has key, store {
        id: UID,
        name: vector<u8>,
        hunger: u64,    // 0 = no, 100 = đói
        happiness: u64, // 0 = buồn, 100 = vui
        hygiene: u64,   // 0 = bẩn, 100 = sạch
    }

    // -- Hàm tạo mèo mới (Mint) --
    public entry fun mint_cat(name: vector<u8>, ctx: &mut TxContext) {
        let cat = Cat {
            id: object::new(ctx),
            name: name,
            hunger: 50,
            happiness: 50,
            hygiene: 50,
        };
        transfer::public_transfer(cat, tx_context::sender(ctx));
    }

    // -- 1. Cho ăn (Giảm đói) --
    public entry fun feed(cat: &mut Cat) {
        if (cat.hunger >= 20) {
            cat.hunger = cat.hunger - 20;
        } else {
            cat.hunger = 0;
        }
    }

    // -- 2. Cưng nựng (Tăng vui vẻ) --
    public entry fun play(cat: &mut Cat) {
        if (cat.happiness <= 80) {
            cat.happiness = cat.happiness + 20;
        } else {
            cat.happiness = 100;
        }
    }

    // -- 3. Dọn cát (Tăng vệ sinh) --
    public entry fun clean_litter(cat: &mut Cat) {
        cat.hygiene = 100;
    }

    // -- 4. Cắt móng (Tăng vệ sinh + Giảm chút vui vẻ vì mèo ghét) --
    public entry fun cut_nails(cat: &mut Cat) {
        cat.hygiene = 100;
        if (cat.happiness >= 10) {
             cat.happiness = cat.happiness - 10;
        }
    }
}