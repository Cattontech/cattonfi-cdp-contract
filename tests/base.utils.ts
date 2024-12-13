import { Address, Cell, Contract, ContractProvider, Transaction, contractAddress, fromNano } from '@ton/core';
import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Errors, Op } from '../wrappers/op-code';
import { JettonWallet } from '../wrappers/JettonWallet';
import { JettonMinter } from '../wrappers/JettonMinter';

export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const sleep = (ms: number) => new Promise((res, rej) => setTimeout(res, ms));

function bodyOp(op: number): (body: Cell | undefined) => boolean {
    return (body: Cell | undefined): boolean => {
        if (body == null) return false;
        const s = body.beginParse();
        return s.remainingBits >= 32 && s.loadUint(32) === op;
    };
}
function extractGasUsed(tx: Transaction): bigint {
    if (tx.description.type !== 'generic') return 0n;
    return tx.description.computePhase.type === 'vm' ? tx.description.computePhase.gasUsed : 0n;
}

export function storeComputeGas(
    opLabel: string,
    opCode: number,
    tx: Transaction | AccumulateTransactionGasUsed | undefined,
    gasUsed: Record<string, bigint> = {},
) {
    if (tx instanceof AccumulateTransactionGasUsed) {
        tx = tx[`${opCode}`]?.[1];
    }
    if (tx == null) {
        throw new Error('no transaction to compute gas for op ' + opLabel);
    }
    if (!bodyOp(opCode)(tx.inMessage?.body ?? Cell.EMPTY) && !bodyOp(0)(tx.inMessage?.body ?? Cell.EMPTY)) {
        throw new Error('invalid transaction to log compute gas for op ' + opLabel);
    }
    const gas = extractGasUsed(tx);
    if (gasUsed[opLabel] == null || gasUsed[opLabel] < gas) {
        gasUsed[opLabel] = gas;
    }
}

export class StoreGasUsed {
    actionGas: Record<string, bigint> = {};
    opGasUsed: Record<string, bigint> = {};

    saveGas(action: string, gas: bigint) {
        if (this.actionGas[action] == null || this.actionGas[action] < gas) {
            this.actionGas[action] = gas;
        }
    }
    logGas() {
        console.table(
            Object.keys(this.actionGas).map((action) => {
                return {
                    action: action,
                    gas: formatCoins(this.actionGas[action]),
                };
            }),
        );
    }
    saveOpGas(
        opLabel: string,
        opcode: number,
        txs: AccumulateTransactionGasUsed | { result: SendMessageResult & { result: void } },
        filterTxs?: { from?: Address; to?: Address },
    ) {
        let gasUsedTxs = txs instanceof AccumulateTransactionGasUsed ? txs : new AccumulateTransactionGasUsed();
        if (!(txs instanceof AccumulateTransactionGasUsed)) {
            if (filterTxs == null || (filterTxs.from == null && filterTxs.to == null)) {
                gasUsedTxs = accumulateUsedGas(gasUsedTxs, txs.result.transactions);
            } else {
                gasUsedTxs = accumulateUsedGas(
                    gasUsedTxs,
                    txs.result.transactions.filter((val) => {
                        if (!val.inMessage || val.inMessage.info.type !== 'internal') return false;
                        if (filterTxs.from != null && !filterTxs.from.equals(val.inMessage.info.src)) return false;
                        if (filterTxs.to != null && !filterTxs.to.equals(val.inMessage.info.dest)) return false;
                        return true;
                    }),
                );
            }
        }
        storeComputeGas(opLabel, opcode, gasUsedTxs, this.opGasUsed);
    }
    logOpGas(opLabels: string[]) {
        return logComputeGas(opLabels, this.opGasUsed);
    }
}

export class AccumulateTransactionGasUsed {
    [opcode: string]: [bigint, Transaction] | undefined;
}

export function accumulateUsedGas(
    gasUsedTxs: AccumulateTransactionGasUsed,
    txs: Transaction[],
): AccumulateTransactionGasUsed {
    for (const tx of txs) {
        const body = tx.inMessage?.body ?? Cell.EMPTY;
        const s = body.beginParse();
        const opcode = s.remainingBits >= 32 ? s.loadUint(32).toString() : '0';
        const gas = extractGasUsed(tx);
        const prev = gasUsedTxs[opcode];
        if (prev == null || prev[0] < gas) {
            gasUsedTxs[opcode] = [gas, tx];
        }
    }
    return gasUsedTxs;
}

export function wrapSend<F>(
    gasUsedTxs: AccumulateTransactionGasUsed,
    treasury: SandboxContract<TreasuryContract>,
    fn: F,
    ...args: F extends (x: infer Via, ...args: infer Args) => infer R ? Args : never
): (isLogTx?: boolean) => Promise<{
    result: SendMessageResult & { result: void };
    gas: bigint;
}> {
    return async (isLogTx = true) => {
        let gas = await treasury.getBalance();
        const result = await (fn as any)(treasury.getSender(), ...args);
        accumulateUsedGas(gasUsedTxs, result.transactions);
        isLogTx && printTransactionFees(result.transactions);
        return { result, gas: gas - (await treasury.getBalance()) };
    };
}

function logGas(opLabel: string, gasUsed: Record<string, bigint> = {}): string | undefined {
    const used = gasUsed[opLabel];
    gasUsed[opLabel] = -1n;
    if (used >= 0n) {
        return 'const int gas::' + opLabel + ' = ' + used.toString() + ';';
    } else if (used == undefined) {
        return 'const int gas::' + opLabel + ' = -1;';
    }
}

export function logComputeGas(opLabels: string[], gasUsed: Record<string, bigint> = {}) {
    const content = opLabels
        .map((val) => logGas(val, gasUsed))
        .filter((el) => el != null)
        .join('\n');
    console.info('Compute Gas:\n' + content);
    return content;
}

const opName = (op: number) => {
    const name = Object.keys(Op).find((val) => (Op as any)[val] === op);
    return name ?? '0x' + op.toString(16);
};

const exitName = (code: number) => {
    const name = Object.keys(Errors).find((val) => (Errors as any)[val] === code);
    return name ?? code;
};

const formatCoins = (value?: bigint) => {
    if (value === undefined) return 'N/A';
    let str = fromNano(value);
    let split = str.split('.');
    let zeroSuffix = split.length === 2 ? 9 - split[1].length : 0;
    return str + ''.padStart(zeroSuffix, '0');
};
export function printTransactionFees(transactions: Transaction[]) {
    console.table(
        transactions
            .map((tx) => {
                if (tx.description.type !== 'generic') return undefined;
                const body = tx.inMessage?.info.type === 'internal' ? tx.inMessage?.body.beginParse() : undefined;
                const op = body === undefined ? 'N/A' : body.remainingBits >= 32 ? body.preloadUint(32) : 'no body';
                const totalFees = formatCoins(tx.totalFees.coins);
                const computeFees = formatCoins(
                    tx.description.computePhase.type === 'vm' ? tx.description.computePhase.gasFees : undefined,
                );
                const totalFwdFees = formatCoins(tx.description.actionPhase?.totalFwdFees ?? undefined);
                const valueIn = formatCoins(
                    tx.inMessage?.info.type === 'internal' ? tx.inMessage.info.value.coins : undefined,
                );
                const valueOut = formatCoins(
                    tx.outMessages
                        .values()
                        .reduce(
                            (total, message) =>
                                total + (message.info.type === 'internal' ? message.info.value.coins : 0n),
                            0n,
                        ),
                );
                const forwardIn = formatCoins(
                    tx.inMessage?.info.type === 'internal' ? tx.inMessage.info.forwardFee : undefined,
                );
                return {
                    op: typeof op === 'number' ? opName(op) : op,
                    valueIn,
                    valueOut,
                    totalFees: totalFees,
                    inForwardFee: forwardIn,
                    outForwardFee: totalFwdFees,
                    outActions: tx.description.actionPhase?.totalActions ?? 'N/A',
                    computeFee: computeFees,
                    exitCode:
                        tx.description.computePhase.type === 'vm'
                            ? exitName(tx.description.computePhase.exitCode)
                            : 'N/A',
                    actionCode: tx.description.actionPhase?.resultCode ?? 'N/A',
                };
            })
            .filter((v) => v !== undefined),
    );
}


export class TestContract implements Contract {
    readonly address: Address;
    readonly init?: { code: Cell; data: Cell };

    constructor(from: Address | { code: Cell; data: Cell; workchain?: number }) {
        if (from instanceof Address) {
            this.address = from;
        } else {
            const init = { code: from.code, data: from.data };
            this.address = contractAddress(from.workchain ?? 0, init);
            this.init = init;
        }
    }

    static fromAddress(address: Address) {
        return new TestContract(address);
    }

    async getTest(provider: ContractProvider, name: string) {
        const result = await provider.get(name, []);
        return result.stack.readNumber();
    }
}

export async function getJettonWallet(
    blockchain: Blockchain,
    JettonMinterAddress: Address,
    ownerAddress: Address,
): Promise<SandboxContract<JettonWallet>> {
    let v = blockchain.openContract(JettonMinter.createFromAddress(JettonMinterAddress));
    return blockchain.openContract(new JettonWallet(await v.getWalletAddressOf(ownerAddress)));
}
