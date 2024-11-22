import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

import { Op } from './op-code';
import { JettonMinter } from './JettonMinter';
export type VaultInfo = {
    balance: bigint;
    is_open: bigint;
    total_deposited: bigint;
    total_fee: bigint;
    deposit_fee: bigint;
    controller_address: Address;
    admin_address: Address;
    vault_wallet_code: Cell;

    cton_total_supply: bigint;
    cton_total_staked: bigint;
    cton_time_delay_withdraw: bigint;
    cton_reward_per_second: bigint;

    cton_acc_reward_per_share: bigint;
    cton_last_reward_time: bigint;

    cton_minter_address: Address;

    ctUSD_total_supply: bigint;
    ctUSD_total_borrow: bigint;
    ctUSD_time_delay_repay: bigint;
    ctUSD_repay_without_debt_fee: bigint;
    ctUSD_interest_rate: bigint;
    ctUSD_borrow_index: bigint;
    ctUSD_last_accrual_time: bigint;
    ctUSD_accrual_interval: bigint;
    ctUSD_minter_address: Address;

    oracle_provider_public_key: bigint;
    oracle_assets_key: bigint;
    oracle_deviation_threshold: bigint;
};

export type VaultConfig = {
    is_open: bigint;
    total_deposited: bigint;
    total_fee: bigint;
    deposit_fee: bigint;
    controller_address: Address | null;
    admin_address: Address | null;
    vault_wallet_code: Cell;

    cton_total_supply: bigint;
    cton_total_staked: bigint;
    cton_time_delay_withdraw: bigint;
    cton_reward_per_second: bigint;
    cton_acc_reward_per_share: bigint;
    cton_last_reward_time: bigint;
    cton_minter_address: Address | null;

    ctUSD_total_supply: bigint;
    ctUSD_total_borrow: bigint;
    ctUSD_time_delay_repay: bigint;
    ctUSD_repay_without_debt_fee: bigint;
    ctUSD_interest_rate: bigint;
    ctUSD_borrow_index: bigint;
    ctUSD_last_accrual_time: bigint;
    ctUSD_accrual_interval: bigint;
    ctUSD_minter_address: Address | null;

    oracle_provider_public_key: bigint;
    oracle_assets_key: bigint;
    oracle_deviation_threshold: bigint;
};

export type VaultFlexibleInfo = {
    acc_reward_per_share: bigint;
    borrow_index: bigint;
    collateral_rate: bigint;
    cton_price: bigint;
};
export type VaultFeeInfo = {
    depositToStakeFee: bigint;
    depositToMintFee: bigint;
    unstakeFee: bigint;
    stakeFee: bigint;
    withdrawTonFee: bigint;
    borrowFee: bigint;
    repayFee: bigint;
    convertFee: bigint;
    liquidationFee: bigint;
    forcedLiquidationFee: bigint;
};

export function VaultConfigToCell(config: VaultConfig): Cell {
    let cton_info = beginCell()
        .storeCoins(config.cton_total_supply)
        .storeCoins(config.cton_total_staked)
        .storeUint(config.cton_time_delay_withdraw, 32)
        .storeUint(config.cton_reward_per_second, 32)
        .storeCoins(config.cton_acc_reward_per_share)
        .storeUint(config.cton_last_reward_time, 64)
        .storeAddress(config.cton_minter_address)
        .endCell();

    let ctUSD_info = beginCell()
        .storeCoins(config.ctUSD_total_supply)
        .storeCoins(config.ctUSD_total_borrow)
        .storeUint(config.ctUSD_time_delay_repay, 32)
        .storeUint(config.ctUSD_repay_without_debt_fee, 16)
        .storeUint(config.ctUSD_interest_rate, 32)
        .storeCoins(config.ctUSD_borrow_index)
        .storeUint(config.ctUSD_last_accrual_time, 64)
        .storeUint(config.ctUSD_accrual_interval, 32)
        .storeAddress(config.ctUSD_minter_address)
        .endCell();

    let ton_oracle = beginCell()
        .storeUint(config.oracle_provider_public_key, 256)
        .storeUint(config.oracle_assets_key, 256)
        .storeUint(config.oracle_deviation_threshold, 8)
        .endCell();

    return beginCell()
        .storeUint(config.is_open, 1)
        .storeCoins(config.total_deposited)
        .storeCoins(config.total_fee)
        .storeUint(config.deposit_fee, 32)
        .storeAddress(config.controller_address)
        .storeAddress(config.admin_address)
        .storeRef(config.vault_wallet_code)
        .storeRef(cton_info)
        .storeRef(ctUSD_info)
        .storeRef(ton_oracle)
        .endCell();
}

export class Vault implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) { }

    static createFromAddress(address: Address) {
        return new Vault(address);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = VaultConfigToCell(config);
        const init = { code, data };
        return new Vault(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    /* ========== Send action ========== */

    async sendDeposit(
        provider: ContractProvider,
        via: Sender,
        gas_fee: bigint,
        value: bigint,
        toAddress: Address,
        isMint: number,
        oracleData: Cell,
    ) {
        let body = beginCell()
            .storeUint(Op.deposit, 32)
            .storeInt(0, 64)
            .storeCoins(value)
            .storeBit(isMint)
            .storeAddress(toAddress)
            .storeRef(oracleData)
            .endCell();

        await provider.internal(via, {
            value: value + gas_fee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body
        });
    }

    async sendUnstake(
        provider: ContractProvider,
        via: Sender,
        gas_fee: bigint,
        value: bigint,
        toAddress: Address,
        oracleData: Cell,
    ) {
        await provider.internal(via, {
            value: gas_fee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.unstake, 32)
                .storeInt(0, 64)
                .storeCoins(value)
                .storeAddress(toAddress)
                .storeRef(oracleData)
                .endCell(),
        });
    }

    async sendUpgradeJettonWalletCode(provider: ContractProvider, via: Sender, value: bigint, jettonMinterAddress: Address, jettonWalletCode: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.call_to, 32)
                .storeInt(0, 64)
                .storeAddress(jettonMinterAddress)
                .storeRef(JettonMinter.getDataUpdateJettonWalletCode(jettonWalletCode))
                .endCell(),
        });
    }

    async sendSetDataForWallet(provider: ContractProvider, via: Sender, value: bigint, toAddress: Address, data: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.set_data_for_wallet, 32)
                .storeInt(0, 64)
                .storeAddress(toAddress)
                .storeRef(data)
                .endCell(),
        });
    }

    async sendWithdraw(provider: ContractProvider, via: Sender, value: bigint, amount: bigint, oracle: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.request_withdraw, 32).storeInt(0, 64).storeCoins(amount).storeRef(oracle).endCell(),
        });
    }

    async sendOpen(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.open, 32).storeInt(0, 64).endCell(),
        });
    }

    async sendClaimAdmin(provider: ContractProvider, via: Sender, value: bigint, jettonMinterAddress: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.call_to_without_ref, 32).storeInt(0, 64).storeAddress(jettonMinterAddress).storeRef(JettonMinter.getDataClaimAdmin()).endCell(),
        });
    }

    async sendClaim(provider: ContractProvider, via: Sender, value: bigint, playerId: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.claim, 32).storeInt(0, 64).storeUint(playerId, 32).endCell(),
        });
    }

    async sendUpgradeOracle(provider: ContractProvider, via: Sender, value: bigint, new_oracle: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.upgrade_oracle, 32).storeInt(0, 64).storeRef(new_oracle).endCell(),
        });
    }

    async sendUpgradeWalletCode(provider: ContractProvider, via: Sender, value: bigint, new_wallet_code: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.upgrade_wallet_code, 32).storeInt(0, 64).storeRef(new_wallet_code).endCell(),
        });
    }

    async sendUpgradeJettonAddress(provider: ContractProvider, via: Sender, value: bigint, cton: Address, ctUSD: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.upgrade_jetton_address, 32).storeInt(0, 64).storeAddress(cton).storeAddress(ctUSD).endCell(),
        });
    }

    async sendLiquidation(provider: ContractProvider, via: Sender, value: bigint, repayAmount: bigint, toAddress: Address, oracleData: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.request_liquidation, 32).storeInt(0, 64).storeCoins(repayAmount).storeAddress(toAddress).storeRef(oracleData).endCell(),
        });
    }

    async sendSetctUSDConfig(provider: ContractProvider, via: Sender, value: bigint, accrual_interval: bigint, repay_without_debt_fee: bigint, interest_rate: bigint, time_delay_repay: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.set_ctUSD_config, 32).storeInt(0, 64).storeUint(accrual_interval, 32).storeUint(repay_without_debt_fee, 16).storeUint(interest_rate, 32).storeUint(time_delay_repay, 32).endCell(),
        });
    }

    async sendForcedLiquidation(provider: ContractProvider, via: Sender, value: bigint, to_address: Address, oracleData: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.forced_liquidation, 32).storeInt(0, 64).storeAddress(to_address).storeRef(oracleData).endCell(),
        });
    }

    async sendAdminWithdraw(provider: ContractProvider, via: Sender, value: bigint, to: Address, amount: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.emergency_withdrawal, 32).storeInt(0, 64).storeAddress(to).storeCoins(amount).endCell(),
        });
    }

    async sendBorrow(
        provider: ContractProvider,
        via: Sender,
        fee: bigint,
        borrow_amount: bigint,
        oracle_data: Cell,
    ) {
        await provider.internal(via, {
            value: fee,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.borrow, 32)
                .storeInt(0, 64)
                .storeCoins(borrow_amount)
                .storeRef(oracle_data)
                .endCell(),
        });
    }

    /* ========== View ========== */

    async getVaultData(provider: ContractProvider): Promise<VaultInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault not active';
        }
        let data = {} as VaultInfo;
        data.balance = state.balance;
        let res = await provider.get('get_vault_data', []);

        data.is_open = res.stack.readBigNumber();
        data.total_deposited = res.stack.readBigNumber();
        data.total_fee = res.stack.readBigNumber();
        data.deposit_fee = res.stack.readBigNumber();
        data.controller_address = res.stack.readAddress();
        data.admin_address = res.stack.readAddress();

        data.vault_wallet_code = res.stack.readCell();

        data.cton_total_supply = res.stack.readBigNumber();
        data.cton_total_staked = res.stack.readBigNumber();
        data.cton_time_delay_withdraw = res.stack.readBigNumber();
        data.cton_reward_per_second = res.stack.readBigNumber();
        data.cton_acc_reward_per_share = res.stack.readBigNumber();
        data.cton_last_reward_time = res.stack.readBigNumber();
        data.cton_minter_address = res.stack.readAddress();

        data.ctUSD_total_supply = res.stack.readBigNumber();
        data.ctUSD_total_borrow = res.stack.readBigNumber();
        data.ctUSD_time_delay_repay = res.stack.readBigNumber();
        data.ctUSD_repay_without_debt_fee = res.stack.readBigNumber();
        data.ctUSD_interest_rate = res.stack.readBigNumber();
        data.ctUSD_borrow_index = res.stack.readBigNumber();
        data.ctUSD_last_accrual_time = res.stack.readBigNumber();
        data.ctUSD_accrual_interval = res.stack.readBigNumber();
        data.ctUSD_minter_address = res.stack.readAddress();

        data.oracle_provider_public_key = res.stack.readBigNumber();
        data.oracle_assets_key = res.stack.readBigNumber();
        data.oracle_deviation_threshold = res.stack.readBigNumber();

        return data;
    }

    async getFlexibleData(provider: ContractProvider, price: bigint): Promise<VaultFlexibleInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault not active';
        }
        let res = await provider.get('get_flexible_data', [
            { type: 'int', value: price },
        ])

        let data = {} as VaultFlexibleInfo;
        data.acc_reward_per_share = res.stack.readBigNumber();
        data.borrow_index = res.stack.readBigNumber();
        data.collateral_rate = res.stack.readBigNumber();
        data.cton_price = res.stack.readBigNumber();
        return data;
    }

    async getWalletAddressOf(provider: ContractProvider, address: Address) {
        return (
            await provider.get('get_wallet_address', [
                { type: 'slice', cell: beginCell().storeAddress(address).endCell() },
            ])
        ).stack.readAddress();
    }

    async getEstFee(provider: ContractProvider): Promise<VaultFeeInfo> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Vault not active';
        }

        let res = await provider.get('get_est_fee', []);
        let vaultFeeInfo = {} as VaultFeeInfo;
        vaultFeeInfo.depositToStakeFee = res.stack.readBigNumber();
        vaultFeeInfo.depositToMintFee = res.stack.readBigNumber();
        vaultFeeInfo.unstakeFee = res.stack.readBigNumber();
        vaultFeeInfo.stakeFee = res.stack.readBigNumber();
        vaultFeeInfo.withdrawTonFee = res.stack.readBigNumber();
        vaultFeeInfo.borrowFee = res.stack.readBigNumber();
        vaultFeeInfo.repayFee = res.stack.readBigNumber();
        vaultFeeInfo.convertFee = res.stack.readBigNumber();
        vaultFeeInfo.liquidationFee = res.stack.readBigNumber();
        vaultFeeInfo.forcedLiquidationFee = res.stack.readBigNumber();
        return vaultFeeInfo;
    }
}
