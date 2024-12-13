import { Address, toNano } from '@ton/core';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { getBounceableAddress, loadDeployInfo, saveDeployInfo } from '../utils';
import { JettonMinter } from '../../wrappers/JettonMinter';
import { UpdateSJettonConfigData, VaultJettonConfig } from '../../wrappers/types';
import { VaultJetton } from '../../wrappers/VaultJetton';

export async function run(provider: NetworkProvider) {
    await deploy(provider);
}

export async function deploy(provider: NetworkProvider) {
    const vaultCode = await compile('VaultJetton');

    const ONE_DAY = 60 * 60 * 15;

    const stTonAddr = loadDeployInfo("stTon", provider.network());
    const stTonMinter = provider.open(JettonMinter.createFromAddress(Address.parse(stTonAddr)));
    const cstTonAddr = loadDeployInfo("cstTon", provider.network());
    const cstTonMinter = provider.open(JettonMinter.createFromAddress(Address.parse(cstTonAddr)));

    const controllerAddress: Address = Address.parse("");
    const adminAddress: Address = provider.sender().address || Address.parse("");
    const VaultJettonWalletCode = await compile('VaultJettonWallet');

    let config: VaultJettonConfig = {
        is_open: 0n,
        controller_address: controllerAddress,
        admin_address: adminAddress,
        wallet_code: VaultJettonWalletCode,
        sJetton_decimals: 9n,
        sJetton_deposit_fee: 1n,
        sJetton_time_delay_withdraw: BigInt(ONE_DAY),
        sJetton_early_withdraw_fee: 150n,
        tJetton_reward_per_second: toNano("0.0001"),
        tJetton_minter_address: cstTonMinter.address,
    };

    const vault = provider.open(VaultJetton.createFromConfig(config, vaultCode));


    await vault.sendDeploy(provider.sender(), toNano('0.1'));
    await provider.waitForDeploy(vault.address);
    await sleep(30000);
    let sendChangeAdminCton = await cstTonMinter.sendChangeAdmin(provider.sender(), toNano('0.05'), vault.address);
    await sleep(30000);

    let sendCallTo = await vault.sendClaimAdmin(
        provider.sender(),
        toNano('0.05'),
        cstTonMinter.address,
    );

    let saveInfo = {
        metadata: {
            is_open: 0,
            controller_address: getBounceableAddress(controllerAddress),
            admin_address: getBounceableAddress(adminAddress),
            wallet_code: VaultJettonWalletCode.toBoc().toString("hex"),
            sJetton_decimals: 9,
            sJetton_deposit_fee: 1,
            sJetton_time_delay_withdraw: ONE_DAY,
            sJetton_early_withdraw_fee: 150,
            tJetton_reward_per_second: toNano("0.0001").toString(),
            tJetton_minter_address: getBounceableAddress(cstTonMinter.address),
        },
        address: getBounceableAddress(vault.address),
    }
    saveDeployInfo("VaultJetton", saveInfo, provider.network())

    await sleep(30000);

    let updateSJettonConfigData: UpdateSJettonConfigData = {
        decimals: 9n,
        deposit_fee: 0n,
        time_delay_withdraw: BigInt(ONE_DAY),
        early_withdraw_fee: 150n,
        wallet_address: await stTonMinter.getWalletAddressOf(vault.address),
        reward_per_second: toNano("0.0001"),
        minter_address: cstTonMinter.address
    }

    let sendUpdateSJettonConfigData = await vault.sendUpdateSJettonConfig(provider.sender(), toNano("0.01"), updateSJettonConfigData);
    await sleep(15000);
    const sendOpen = await vault.sendOpen(provider.sender(), toNano('0.05'));
    await sleep(30000);
}
