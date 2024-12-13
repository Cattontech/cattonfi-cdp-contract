import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, OpenedContract, Sender, SendMode } from '@ton/core';

import { Op } from './op-code';
import { JettonMinter } from './JettonMinter';
import { VaultJettonConfig, VaultJettonInfo, VaultJettonWalletData, UpdateSJettonConfigData, VaultJettonFlexibleInfo, FeeInfo } from './types';

export function VaultJettonConfigToCell(config: VaultJettonConfig): Cell {
    let sJetton_info = beginCell()
        .storeUint(config.sJetton_decimals, 8)
        .storeCoins(0)
        .storeUint(config.sJetton_deposit_fee, 32)
        .storeUint(config.sJetton_time_delay_withdraw, 64)
        .storeUint(config.sJetton_early_withdraw_fee, 32)
        .storeAddress(config.admin_address)
        .endCell();

    let tJetton_info = beginCell()
        .storeCoins(0)
        .storeCoins(0)
        .storeCoins(config.tJetton_reward_per_second)
        .storeCoins(0)
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeAddress(config.admin_address)
        .endCell();

    let s_t_Jetton_info = beginCell().storeRef(sJetton_info).storeRef(tJetton_info).endCell();

    return beginCell()
        .storeInt(config.is_open, 1)
        .storeCoins(0)
        .storeCoins(0)
        .storeCoins(0)
        .storeAddress(config.controller_address)
        .storeAddress(config.admin_address)
        .storeRef(config.wallet_code || Cell.EMPTY)
        .storeRef(s_t_Jetton_info)
        .endCell();
}

export class VaultJetton implements Contract {
    info = {} as VaultJettonInfo
    flexibleInfo = {} as VaultJettonFlexibleInfo

    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) { }

    static createFromAddress(address: Address) {
        return new VaultJetton(address);
    }

    static createFromConfig(config: VaultJettonConfig, code: Cell, workchain = 0) {
        const data = VaultJettonConfigToCell(config);
        const init = { code, data };
        return new VaultJetton(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, gasFee: bigint) {
        await provider.internal(via, {
            value: gasFee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendClaimAdmin(provider: ContractProvider, via: Sender, gasFee: bigint, jettonMinterAddress: Address) {
        await provider.internal(via, {
            value: gasFee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.call_to_without_ref, 32).storeInt(0, 64).storeAddress(jettonMinterAddress).storeRef(JettonMinter.getDataClaimAdmin()).endCell(),
        });
    }

    async sendUpgradeJettonCode(provider: ContractProvider, via: Sender, gasFee: bigint, jettonMinterAddress: Address, newCode: Cell) {
        await provider.internal(via, {
            value: gasFee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.call_to, 32)
                .storeInt(0, 64)
                .storeAddress(jettonMinterAddress)
                .storeRef(JettonMinter.getDataUpgrade(newCode))
                .endCell(),
        });
    }

    async sendUpgradeJettonWalletCode(provider: ContractProvider, via: Sender, gasFee: bigint, jettonMinterAddress: Address, jettonWalletCode: Cell) {
        await provider.internal(via, {
            value: gasFee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.call_to, 32)
                .storeInt(0, 64)
                .storeAddress(jettonMinterAddress)
                .storeRef(JettonMinter.getDataUpdateJettonWalletCode(jettonWalletCode))
                .endCell(),
        });
    }

    async sendUpgradeCode(provider: ContractProvider, via: Sender, gasFee: bigint, newCode: Cell) {
        await provider.internal(via, {
            value: gasFee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.upgrade_code, 32).storeInt(0, 64).storeRef(newCode).endCell(),
        });
    }

    async sendUpdateSJettonConfig(provider: ContractProvider, via: Sender, gasFee: bigint, data: UpdateSJettonConfigData) {
        const body: Cell = beginCell()
            .storeUint(Op.update_sJetton_config, 32)
            .storeInt(0, 64)
            .storeInt(data.decimals, 8)
            .storeInt(data.deposit_fee, 32)
            .storeInt(data.time_delay_withdraw, 64)
            .storeInt(data.early_withdraw_fee, 32)
            .storeAddress(data.wallet_address)
            .storeCoins(data.reward_per_second)
            .storeAddress(data.minter_address)
            .endCell();

        await provider.internal(via, {
            value: gasFee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body
        });
    }

    async sendOpen(provider: ContractProvider, via: Sender, gasFee: bigint) {
        await provider.internal(via, {
            value: gasFee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.open, 32).storeInt(0, 64).endCell(),
        });
    }

    /* ========== View ========== */
    async getVaultData(provider: ContractProvider): Promise<VaultJettonInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault not active';
        }

        let res = await provider.get('get_vault_data', []);

        this.info.balance = state.balance;

        this.info.is_open = res.stack.readBigNumber();
        this.info.total_fee = res.stack.readBigNumber();
        this.info.total_withdraw_fee = res.stack.readBigNumber();
        this.info.total_convert = res.stack.readBigNumber();
        this.info.controller_address = res.stack.readAddress();
        this.info.admin_address = res.stack.readAddress();
        this.info.wallet_code = res.stack.readCell();

        this.info.sJetton_decimals = res.stack.readBigNumber();
        this.info.sJetton_total_deposited = res.stack.readBigNumber();
        this.info.sJetton_deposit_fee = res.stack.readBigNumber();
        this.info.sJetton_time_delay_withdraw = res.stack.readBigNumber();
        this.info.sJetton_early_withdraw_fee = res.stack.readBigNumber();
        this.info.sJetton_wallet_address = res.stack.readAddress();
        this.info.tJetton_total_supply = res.stack.readBigNumber();
        this.info.tJetton_total_staked = res.stack.readBigNumber();
        this.info.tJetton_reward_per_second = res.stack.readBigNumber();
        this.info.tJetton_acc_reward_per_share = res.stack.readBigNumber();
        this.info.tJetton_last_reward_time = res.stack.readBigNumber();
        this.info.tJetton_minter_address = res.stack.readAddress();

        return this.info
    }

    async getFlexibleData(provider: ContractProvider, tonPrice: bigint): Promise<VaultJettonFlexibleInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault not active';
        }
        let res = await provider.get('get_flexible_data', [
            { type: 'int', value: tonPrice },
        ])

        this.flexibleInfo.tJetton_acc_reward_per_share = res.stack.readBigNumber();

        return this.flexibleInfo;
    }

    async getWalletAddressOf(provider: ContractProvider, address: Address) {
        return (
            await provider.get('get_wallet_address', [
                { type: 'slice', cell: beginCell().storeAddress(address).endCell() },
            ])
        ).stack.readAddress();
    }

    async getEstFee(provider: ContractProvider): Promise<FeeInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault not active';
        }

        let res = await provider.get('get_est_fee', []);
        let feeInfo = {} as FeeInfo;
        feeInfo.deposit_sJetton_fee = res.stack.readBigNumber();
        feeInfo.unstake_tJetton_fee = res.stack.readBigNumber();
        feeInfo.deposit_tJetton_fee = res.stack.readBigNumber();
        feeInfo.withdraw_sJetton_fee = res.stack.readBigNumber();
        return feeInfo;
    }

    /* ========== Send action ========== */

    dataDepositJetton(
        gasFee: bigint,
        forwardFee: bigint,
        amount: bigint
    ): any {
        const forwardPayload = beginCell().storeUint(Op.deposit, 32).endCell();
        return { gasFee: gasFee, forwardFee: forwardFee, receivedAddress: this.address, responseAddress: null, amount, forwardPayload };
    }

    async sendUnstake(
        provider: ContractProvider,
        via: Sender,
        gas_fee: bigint,
        value: bigint
    ) {
        await provider.internal(via, {
            value: gas_fee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.unstake, 32)
                .storeInt(0, 64)
                .storeCoins(value)
                .endCell(),
        });
    }

    async sendWithdraw(provider: ContractProvider, via: Sender, value: bigint, amount: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.request_withdraw, 32).storeInt(0, 64).storeCoins(amount).endCell(),
        });
    }

    async sendClaim(provider: ContractProvider, via: Sender, value: bigint, playerId: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.claim, 32).storeInt(0, 64).storeUint(playerId, 64).endCell(),
        });
    }
}
