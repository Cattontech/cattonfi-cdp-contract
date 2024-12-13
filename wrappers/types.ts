import { Address, Cell } from "@ton/core";

export type UpdateSJettonConfigData = {
    decimals: bigint;
    deposit_fee: bigint;
    time_delay_withdraw: bigint;
    early_withdraw_fee: bigint;
    wallet_address: Address;
    reward_per_second: bigint;
    minter_address: Address;
};

export type VaultJettonWalletData = {
    status: boolean;
    owner_address: Address;
    VaultJetton_address: Address;

    tJetton_balance: bigint;
    tJetton_reward_debt: bigint;
    tJetton_pending_reward: bigint;
    tJetton_unlock_time: bigint;
};

export type VaultJettonInfo = {
    balance: bigint;
    is_open: bigint;
    total_fee: bigint;
    total_withdraw_fee: bigint;
    total_convert: bigint;
    controller_address: Address;
    admin_address: Address;
    wallet_code: Cell;

    sJetton_decimals: bigint;
    sJetton_total_deposited: bigint;
    sJetton_deposit_fee: bigint;
    sJetton_time_delay_withdraw: bigint;
    sJetton_early_withdraw_fee: bigint;
    sJetton_wallet_address: Address;
    tJetton_total_supply: bigint;
    tJetton_total_staked: bigint;
    tJetton_reward_per_second: bigint;
    tJetton_acc_reward_per_share: bigint;
    tJetton_last_reward_time: bigint;
    tJetton_minter_address: Address;
};

export type VaultJettonConfig = {
    is_open: bigint;
    controller_address: Address | null;
    admin_address: Address | null;
    wallet_code: Cell | null;

    sJetton_decimals: bigint;
    sJetton_deposit_fee: bigint;
    sJetton_time_delay_withdraw: bigint;
    sJetton_early_withdraw_fee: bigint;
    tJetton_reward_per_second: bigint;
    tJetton_minter_address: Address | null;
};

export type VaultJettonFlexibleInfo = {
    tJetton_acc_reward_per_share: bigint;
};

export type FeeInfo = {
    deposit_sJetton_fee: bigint;
    unstake_tJetton_fee: bigint;
    deposit_tJetton_fee: bigint;
    withdraw_sJetton_fee: bigint;
};
