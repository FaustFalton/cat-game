module contract::cat_move {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};

    const CAT_PRICE: u64 = 100000000; // 0.1 SUI

    struct GameStore has key { id: UID, profits: Balance<SUI> }
    struct Cat has key, store { 
        id: UID, name: vector<u8>, breed: u8, 
        hunger: u64, happiness: u64 
    }
    struct FishBasket has key, store { id: UID, amount: u64 }

    fun init(ctx: &mut TxContext) {
        let shop = GameStore { id: object::new(ctx), profits: balance::zero() };
        transfer::share_object(shop);
    }

    public entry fun buy_cat(shop: &mut GameStore, payment: Coin<SUI>, breed_choice: u8, name: vector<u8>, ctx: &mut TxContext) {
        let value = coin::value(&payment);
        assert!(value >= CAT_PRICE, 0);
        balance::join(&mut shop.profits, coin::into_balance(payment));
        let cat = Cat { id: object::new(ctx), name, breed: breed_choice, hunger: 50, happiness: 50 };
        transfer::public_transfer(cat, tx_context::sender(ctx));
    }

    public entry fun create_basket(ctx: &mut TxContext) {
        let basket = FishBasket { id: object::new(ctx), amount: 10 }; // Tặng 10 cá
        transfer::public_transfer(basket, tx_context::sender(ctx));
    }

    // --- 3 HÀM TƯƠNG TÁC ---

    // 1. Cho ăn: Tốn 1 Cá -> Tăng No
    public entry fun feed_cat(cat: &mut Cat, basket: &mut FishBasket) {
        if (basket.amount > 0) {
            basket.amount = basket.amount - 1;
            cat.hunger = 0; 
        }
    }

    // 2. Cưng nựng: Tốn 1 Cá (như bạn yêu cầu) -> Tăng Vui
    public entry fun pet_cat(cat: &mut Cat, basket: &mut FishBasket) {
        if (basket.amount > 0) {
            basket.amount = basket.amount - 1;
            cat.happiness = 100;
        }
    }

    // 3. Cắt móng: KHÔNG tốn cá -> Giảm Vui (Mèo ghét)
    public entry fun cut_nails(cat: &mut Cat) {
        cat.happiness = 0; // Mèo buồn thiu
    }
}