import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

import { Op } from './op-code';

export type VaultWalletInfo = {
    balance: bigint;
    collateral: bigint;
    in_during_liquidation: boolean;
    reward_debt: bigint;
    unlock_time: bigint;
    balance_ctUSD: bigint;
    withdraw_time: bigint;
    principal_amount: bigint;
    borrow_index: bigint;
    owner_address: Address;
    vault_address: Address;
    borrow_amount: bigint;
    pending_reward: bigint;
};

export type FlexibleInfo = {
    pending_reward: bigint;
    borrow_amount: bigint;
    collateral_rate: bigint;
    max_withdraw: bigint;
    partial_liquidation_price: bigint;
    full_liquidation_price: bigint;
};


export class VaultWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) { }

    static createFromAddress(vaultAddress: Address) {
        return new VaultWallet(vaultAddress);
    }

    async getVaulWallettData(provider: ContractProvider): Promise<VaultWalletInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault Wallet not active';
        }
        let data = {} as VaultWalletInfo;
        data.balance = state.balance;

        let res = await provider.get('get_wallet_data', []);

        data.collateral = res.stack.readBigNumber();
        data.in_during_liquidation = res.stack.readBoolean();

        data.reward_debt = res.stack.readBigNumber();
        data.unlock_time = res.stack.readBigNumber();

        data.balance_ctUSD = res.stack.readBigNumber();
        data.withdraw_time = res.stack.readBigNumber();

        data.principal_amount = res.stack.readBigNumber();
        data.borrow_index = res.stack.readBigNumber();

        data.owner_address = res.stack.readAddress();
        data.vault_address = res.stack.readAddress();
        data.borrow_amount = res.stack.readBigNumber();
        data.pending_reward = res.stack.readBigNumber();
        return data;
    }

    async sendConvert(provider: ContractProvider, via: Sender, value: bigint, convert_amount: bigint, is_recieve_ton: number, oracleData: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.request_convert, 32).storeInt(0, 64).storeCoins(convert_amount).storeBit(is_recieve_ton).storeRef(oracleData).endCell(),
        });
    }

    async sendLiquidation(provider: ContractProvider, via: Sender, value: bigint, repayAmount: bigint, toAddress: Address, oracleData: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.request_liquidation, 32).storeInt(0, 64).storeCoins(repayAmount).storeAddress(toAddress).storeRef(oracleData).endCell(),
        });
    }

    async getWalletAddressOf(provider: ContractProvider, address: Address) {
        return (
            await provider.get('get_wallet_address', [
                { type: 'slice', cell: beginCell().storeAddress(address).endCell() },
            ])
        ).stack.readAddress();
    }

    async getFlexibleData(provider: ContractProvider, accRewardPerShare: bigint, borrow_index: bigint, price: bigint): Promise<FlexibleInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault Wallet not active';
        }

        let res = await provider.get('get_flexible_data', [
            { type: 'int', value: accRewardPerShare },
            { type: 'int', value: borrow_index },
            { type: 'int', value: price },
        ])

        let data = {} as FlexibleInfo;
        data.pending_reward = res.stack.readBigNumber();
        data.borrow_amount = res.stack.readBigNumber();
        data.collateral_rate = res.stack.readBigNumber();
        data.max_withdraw = res.stack.readBigNumber();
        data.partial_liquidation_price = res.stack.readBigNumber();
        data.full_liquidation_price = res.stack.readBigNumber();
        return data;
    }
}
