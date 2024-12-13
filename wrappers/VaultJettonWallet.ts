import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

import { Op } from './op-code';

export type WalletInfo = {
    balance: bigint;
    status: boolean;
    tJetton_balance: bigint;
    tJetton_reward_debt: bigint;
    tJetton_pending_reward: bigint;
    tJetton_unlock_time: bigint;
    owner_address: Address;
    sVault_address: Address;
};

export type FlexibleInfo = {
    pending_reward: bigint;
};


export class VaultJettonWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) { }

    static createFromAddress(vaultAddress: Address) {
        return new VaultJettonWallet(vaultAddress);
    }

    async getWallettData(provider: ContractProvider): Promise<WalletInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault Wallet not active';
        }
        let data = {} as WalletInfo;
        data.balance = state.balance;

        let res = await provider.get('get_wallet_data', []);

        data.status = res.stack.readBoolean();

        data.tJetton_balance = res.stack.readBigNumber();
        data.tJetton_reward_debt = res.stack.readBigNumber();
        data.tJetton_pending_reward = res.stack.readBigNumber();
        data.tJetton_unlock_time = res.stack.readBigNumber();

        data.owner_address = res.stack.readAddress();
        data.sVault_address = res.stack.readAddress();
        return data;
    }


    async getFlexibleData(provider: ContractProvider, accRewardPerShare: bigint): Promise<FlexibleInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault Wallet not active';
        }

        let res = await provider.get('get_flexible_data', [
            { type: 'int', value: accRewardPerShare }
        ])

        let data = {} as FlexibleInfo;
        data.pending_reward = res.stack.readBigNumber();

        return data;
    }
}
