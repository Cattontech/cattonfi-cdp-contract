import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { Op } from './op-code';
import { compile } from '@ton/blueprint';
export function contentToCell(type: bigint, uri: string) {
    return beginCell()
        .storeUint(type, 8)
        .storeStringTail(uri) //Snake logic under the hood
        .endCell();
}
export type JettonMinterConfig = {
    admin: Address;
    content: Cell;
    walletCode: Cell;
    vaultWalletCode: Cell;
};

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(config.admin)
        .storeAddress(config.admin)
        .storeRef(config.walletCode)
        .storeRef(config.content)
        .storeRef(config.vaultWalletCode)
        .endCell();
}

export class JettonMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) { }

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0xd372158c, 32).storeUint(0, 64).endCell(),
        });
    }

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        fee: bigint,
        forward_ton_amount: bigint,
        from_address: Address,
        response_address: Address,
        to_amount: bigint,
    ) {
        const forwardPayload = beginCell()
            .storeInt(Op.internal_transfer, 32)
            .storeInt(0, 64)
            .storeCoins(to_amount)
            .storeAddress(from_address)
            .storeAddress(response_address)
            .storeCoins(forward_ton_amount)
            .storeBit(-1)
            .endCell();

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.mint, 32)
                .storeUint(0, 64)
                .storeAddress(from_address)
                .storeCoins(toNano("0.1"))
                .storeRef(forwardPayload)
                .endCell(),
            value: fee,
        });
    }

    async sendProvideWalletAddress(provider: ContractProvider, via: Sender, value: bigint, ownerAddress: Address) {
        let message = beginCell()
            .storeAddress(ownerAddress)
            .storeInt(-1, 1)
            .endCell()

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: message,
            value: value,
        });
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, value: bigint, newAdmin: Address) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.change_admin, 32).storeUint(0, 64).storeAddress(newAdmin).endCell(),
            value: value,
        });
    }

    async sendClaimAdmin(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.claim_admin, 32).storeUint(0, 64).endCell(),
            value: value,
        });
    }

    async sendUpdateContent(provider: ContractProvider, via: Sender, value: bigint, content: Cell) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(4, 32).storeUint(0, 64).storeRef(content).endCell(),
            value: value,
        });
    }

    async getWalletAddressOf(provider: ContractProvider, address: Address) {
        return (
            await provider.get('get_wallet_address', [
                { type: 'slice', cell: beginCell().storeAddress(address).endCell() },
            ])
        ).stack.readAddress();
    }

    async getNextAdminAddress(provider: ContractProvider) {
        return (
            await provider.get('get_next_admin_address', [

            ])
        ).stack.readAddress();
    }

    async getWalletCode(provider: ContractProvider) {
        let stack = (await provider.get('get_jetton_data', [])).stack;
        stack.skip(4);
        return stack.readCell();
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw 'Jetton not active';
        }

        return state.balance;
    }

    async sendUpgrade(provider: ContractProvider, via: Sender, value: bigint, newCode: Cell, data: Cell) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.upgrade, 32).storeUint(0, 64).storeRef(data).storeRef(newCode).endCell(),
            value: value,
        });
    }

    async getJettonData(provider: ContractProvider) {
        let res = await provider.get('get_jetton_data', []);
        console.log(res)
        return {
            total_supply: res.stack.readBigNumber(), mint: res.stack.readBigNumber(), admin_address: res.stack.readAddressOpt(), content: res.stack.readCell(), jetton_wallet_code: res.stack.readCell()
        }
    }

    async getVaultWalletAddressOf(provider: ContractProvider, address: Address) {
        return (
            await provider.get('get_vault_address', [
                { type: 'slice', cell: beginCell().storeAddress(address).endCell() },
            ])
        ).stack.readAddress();
    }

    static getDataUpdateJettonWalletCode(newJettonWalletCode: Cell): Cell {
        return beginCell().storeUint(Op.upgrade_jetton_wallet_code, 32).storeUint(0, 64).storeRef(newJettonWalletCode).endCell();
    }

    static getDataChangeAdmin(new_admin: Address): Cell {
        return beginCell().storeUint(Op.change_admin, 32).storeUint(0, 64).storeAddress(new_admin).endCell();
    }

    static getDataClaimAdmin(): Cell {
        return beginCell().storeUint(Op.claim_admin, 32).storeUint(0, 64).endCell();
    }

    static getDataCallTo(payload: Cell): Cell {
        return beginCell().storeUint(Op.call_to, 32).storeUint(0, 64).storeRef(payload).endCell();
    }

    static getDataChangeContent(new_content: Cell): Cell {
        return beginCell().storeUint(Op.change_content, 32).storeUint(0, 64).storeRef(new_content).endCell();
    }

    static getDataUpgrade(new_code: Cell): Cell {
        return beginCell().storeUint(Op.upgrade, 32).storeUint(0, 64).storeRef(new_code).endCell();
    }

    static getDataUpgradeWalletCode(new_wallet_code: Cell): Cell {
        return beginCell().storeUint(Op.upgrade_wallet_code, 32).storeUint(0, 64).storeRef(new_wallet_code).endCell();
    }
}
