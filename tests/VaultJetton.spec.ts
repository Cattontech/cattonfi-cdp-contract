import { compile } from "@ton/blueprint";
import '@ton/test-utils';
import { beginCell, Cell, fromNano, toNano } from "@ton/core";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { JettonMinter } from "../wrappers/JettonMinter";
import { VaultJetton } from "../wrappers/VaultJetton";
import { FeeInfo, UpdateSJettonConfigData, VaultJettonConfig } from "../wrappers/types";
import { getJettonWallet, printTransactionFees } from "./base.utils";
import { VaultJettonWallet } from "../wrappers/VaultJettonWallet";


describe('VaultJetton', () => {
    let VaultJettonWalletCode: Cell;
    let VaultJettonCode: Cell;
    let jettonCode: Cell;
    let jettonWalletCode: Cell;

    const ONE_DAY = 60 * 60 * 24;
    const SJETTON_PRICE = 6;

    beforeAll(async () => {
        VaultJettonWalletCode = await compile('VaultJettonWallet');
        VaultJettonCode = await compile('VaultJetton');
        jettonCode = await compile('JettonMinter');
        jettonWalletCode = await compile('JettonWallet');
    });
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let controller: SandboxContract<TreasuryContract>;
    let player1: SandboxContract<TreasuryContract>;
    let player2: SandboxContract<TreasuryContract>;
    let player3: SandboxContract<TreasuryContract>;
    let vaultJetton: SandboxContract<VaultJetton>;
    let sJettonMinter: SandboxContract<JettonMinter>;
    let tJettonMinter: SandboxContract<JettonMinter>;

    let config: VaultJettonConfig = {
        is_open: 0n,
        controller_address: null,
        admin_address: null,
        wallet_code: null,
        sJetton_decimals: 0n,
        sJetton_deposit_fee: 0n,
        sJetton_time_delay_withdraw: 0n,
        sJetton_early_withdraw_fee: 0n,
        tJetton_reward_per_second: 0n,
        tJetton_minter_address: null,
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        controller = await blockchain.treasury('controller');
        admin = await blockchain.treasury('admin');
        player1 = await blockchain.treasury('player1');
        player2 = await blockchain.treasury('player2');
        player3 = await blockchain.treasury('player3');

        sJettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    walletCode: jettonWalletCode,
                    admin: admin.address,
                    content: beginCell().storeMaybeStringTail('sJettonMinter').endCell(),
                    vaultWalletCode: VaultJettonWalletCode,
                },
                jettonCode,
            ),
        );
        tJettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    walletCode: jettonWalletCode,
                    admin: admin.address,
                    content: beginCell().storeMaybeStringTail('tJettonMinter').endCell(),
                    vaultWalletCode: VaultJettonWalletCode,
                },
                jettonCode,
            ),
        );

        const sJettonMinterDeploy = await sJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));
        const tJettonMinterDeploy = await tJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));

        config.controller_address = controller.address;
        config.admin_address = admin.address;
        config.wallet_code = VaultJettonWalletCode;
        config.tJetton_minter_address = tJettonMinter.address;


        vaultJetton = blockchain.openContract(VaultJetton.createFromConfig(config, VaultJettonCode));

        const vaultJettonDeployResult = await vaultJetton.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(vaultJettonDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vaultJetton.address,
            deploy: true,
            success: true,
        });

        let updateSJettonConfigData: UpdateSJettonConfigData = {
            decimals: 9n,
            deposit_fee: 0n,
            time_delay_withdraw: BigInt(ONE_DAY),
            early_withdraw_fee: 150n,
            wallet_address: await sJettonMinter.getWalletAddressOf(vaultJetton.address),
            reward_per_second: toNano("0.0001"),
            minter_address: tJettonMinter.address
        }

        let sendUpdateSJettonConfigData = await vaultJetton.sendUpdateSJettonConfig(admin.getSender(), toNano("0.01"), updateSJettonConfigData);
        // printTransactionFees(sendUpdateSJettonConfigData.transactions);

        const sendOpen = await vaultJetton.sendOpen(admin.getSender(), toNano('0.005'));
        // printTransactionFees(sendOpen.transactions);

        let sendChangeAdmin = await tJettonMinter.sendChangeAdmin(admin.getSender(), toNano('0.05'), vaultJetton.address);
        expect(sendChangeAdmin.transactions).toHaveTransaction({ from: admin.address, to: tJettonMinter.address, success: true });
        // printTransactionFees(sendChangeAdmin.transactions);

        let sendCallTo = await vaultJetton.sendClaimAdmin(admin.getSender(), toNano('0.01'), tJettonMinter.address);
        // printTransactionFees(sendCallTo.transactions);
        expect(sendCallTo.transactions).toHaveTransaction({ from: admin.address, to: vaultJetton.address, success: true });
        expect(sendCallTo.transactions).toHaveTransaction({ from: vaultJetton.address, to: tJettonMinter.address, success: true });

    });

    it('deploy success and get vault info', async () => {
        await vaultJetton.getVaultData();
        expect(vaultJetton.info.is_open).toEqual(-1n);
        expect(vaultJetton.info.total_fee).toEqual(0n);
        expect(vaultJetton.info.total_withdraw_fee).toEqual(0n);
        expect(vaultJetton.info.total_convert).toEqual(0n);
        expect(vaultJetton.info.controller_address).toEqualAddress(controller.address);
        expect(vaultJetton.info.admin_address).toEqualAddress(admin.address);
        expect(vaultJetton.info.wallet_code).toEqualCell(VaultJettonWalletCode);

        expect(vaultJetton.info.sJetton_decimals).toEqual(9n);
        expect(vaultJetton.info.sJetton_deposit_fee).toEqual(0n);
        expect(vaultJetton.info.sJetton_total_deposited).toEqual(0n);
        expect(vaultJetton.info.sJetton_time_delay_withdraw).toEqual(BigInt(ONE_DAY));
        expect(vaultJetton.info.sJetton_early_withdraw_fee).toEqual(150n);
        expect(vaultJetton.info.sJetton_wallet_address).toEqualAddress(await sJettonMinter.getWalletAddressOf(vaultJetton.address));
        expect(vaultJetton.info.tJetton_total_supply).toEqual(0n);
        expect(vaultJetton.info.tJetton_total_staked).toEqual(0n);
        expect(vaultJetton.info.tJetton_reward_per_second).toEqual(toNano("0.0001"));
        expect(vaultJetton.info.tJetton_acc_reward_per_share).toEqual(0n);
        expect(vaultJetton.info.tJetton_last_reward_time).toEqual(0n);
        expect(vaultJetton.info.tJetton_minter_address).toEqualAddress(tJettonMinter.address);
    });

    it('Mint sJetton to player1,2', async () => {
        await sJettonMinter.sendMint(admin.getSender(), toNano(0.01), toNano(0.3), player1.address, null, toNano("1000"));
        await sJettonMinter.sendMint(admin.getSender(), toNano(0.01), toNano(0.3), player2.address, null, toNano("2000"));
        const sJettonWalletPlayer1 = await getJettonWallet(blockchain, sJettonMinter.address, player1.address);
        const sJettonBalancePlayer1 = await sJettonWalletPlayer1.getJettonBalance();

        const sJettonWalletPlayer2 = await getJettonWallet(blockchain, sJettonMinter.address, player2.address);
        const sJettonBalancePlayer2 = await sJettonWalletPlayer2.getJettonBalance();

        expect(sJettonBalancePlayer1).toEqual(toNano("1000"));
        expect(sJettonBalancePlayer2).toEqual(toNano("2000"));
    });

    async function playerDeposit(palyer: SandboxContract<TreasuryContract>) {
        await sJettonMinter.sendMint(admin.getSender(), toNano(0.01), toNano(0.3), palyer.address, null, toNano("1000"));
        const sJettonWalletPlayer = await getJettonWallet(blockchain, sJettonMinter.address, palyer.address);
        let sJettonBalancePlayer = await sJettonWalletPlayer.getJettonBalance();
        expect(sJettonBalancePlayer).toEqual(toNano("1000"));
        // send action deposit

        const dataDepositJetton = vaultJetton.dataDepositJetton(toNano("0.1"), toNano("0.1"), toNano("500"));
        palyer = blockchain.openContract(palyer);
        const sendDepositJetton = await sJettonWalletPlayer.sendTransfer(palyer.getSender(), dataDepositJetton.gasFee, dataDepositJetton.forwardFee, dataDepositJetton.receivedAddress, dataDepositJetton.responseAddress, dataDepositJetton.amount, dataDepositJetton.forwardPayload);
        printTransactionFees(sendDepositJetton.transactions);
    }
    it('Player1 deposit sJetton to Vault', async () => {
        await playerDeposit(player1);
        const vaultWalletPlayer1 = blockchain.openContract(VaultJettonWallet.createFromAddress(await vaultJetton.getWalletAddressOf(player1.address)));
        const walletInfo = await vaultWalletPlayer1.getWallettData();
        expect(walletInfo.status).toEqual(true);
        expect(walletInfo.tJetton_balance).toEqual(toNano("500"));
        expect(parseInt(String(walletInfo.tJetton_unlock_time))).toBeGreaterThan(Date.now() / 1000);
        const sJettonWalletPlayer1 = await getJettonWallet(blockchain, sJettonMinter.address, player1.address);
        let sJettonBalancePlayer1 = await sJettonWalletPlayer1.getJettonBalance();
        expect(sJettonBalancePlayer1).toEqual(toNano("500"));
    });

    it('Player1 unstake tJetton', async () => {
        await playerDeposit(player1);
        const sendUnstake = await vaultJetton.sendUnstake(player1.getSender(), toNano("0.1"), toNano(500));
        printTransactionFees(sendUnstake.transactions);
        const vaultWalletPlayer1 = blockchain.openContract(VaultJettonWallet.createFromAddress(await vaultJetton.getWalletAddressOf(player1.address)));
        const walletInfo = await vaultWalletPlayer1.getWallettData();
        expect(walletInfo.status).toEqual(true);
        expect(walletInfo.tJetton_balance).toEqual(toNano("0"));
        const vaultFlexInfo = await vaultJetton.getFlexibleData(BigInt(SJETTON_PRICE + 1));
        const flexInfo = await vaultWalletPlayer1.getFlexibleData(vaultFlexInfo.tJetton_acc_reward_per_share);
        console.log("flexInfo", flexInfo);

        //  check balance sJetton
        const sJettonWalletPlayer1 = await getJettonWallet(blockchain, sJettonMinter.address, player1.address);
        let sJettonBalancePlayer1 = await sJettonWalletPlayer1.getJettonBalance();
        expect(sJettonBalancePlayer1).toEqual(toNano("500"));
        //  check balance tJetton
        const tJettonWalletPlayer1 = await getJettonWallet(blockchain, tJettonMinter.address, player1.address);
        let tJettonBalancePlayer1 = await tJettonWalletPlayer1.getJettonBalance();
        expect(tJettonBalancePlayer1).toEqual(toNano("500"));
    });

    it('Player2 not deposit and unstake tJetton fail, player1 unstake fail', async () => {
        await playerDeposit(player1);
        let sendUnstake = await vaultJetton.sendUnstake(player2.getSender(), toNano("0.1"), toNano(0));
        printTransactionFees(sendUnstake.transactions);
        expect(sendUnstake.transactions).toHaveTransaction({ from: player2.address, to: vaultJetton.address, success: false, exitCode: 4007 });

        sendUnstake = await vaultJetton.sendUnstake(player2.getSender(), toNano("0.1"), toNano(1));
        printTransactionFees(sendUnstake.transactions);
        expect(sendUnstake.transactions).toHaveTransaction({ from: player2.address, to: vaultJetton.address, success: true });
        const vaultWalletPlayer2 = blockchain.openContract(VaultJettonWallet.createFromAddress(await vaultJetton.getWalletAddressOf(player2.address)));
        expect(sendUnstake.transactions).toHaveTransaction({ from: vaultJetton.address, to: vaultWalletPlayer2.address, deploy: false });

        const vaultWalletPlayer1 = blockchain.openContract(VaultJettonWallet.createFromAddress(await vaultJetton.getWalletAddressOf(player1.address)));
        sendUnstake = await vaultJetton.sendUnstake(player1.getSender(), toNano("0.1"), toNano(501));
        printTransactionFees(sendUnstake.transactions);
        expect(sendUnstake.transactions).toHaveTransaction({ from: player1.address, to: vaultJetton.address, exitCode: 5 });

        await playerDeposit(player3);

        sendUnstake = await vaultJetton.sendUnstake(player1.getSender(), toNano("0.1"), toNano(501));
        printTransactionFees(sendUnstake.transactions);
        expect(sendUnstake.transactions).toHaveTransaction({ from: vaultJetton.address, to: vaultWalletPlayer1.address, exitCode: 56 });

        await vaultJetton.getVaultData();
        expect(vaultJetton.info.sJetton_total_deposited).toEqual(toNano(1000));
        expect(vaultJetton.info.tJetton_total_supply).toEqual(0n);
        expect(vaultJetton.info.tJetton_total_staked).toEqual(toNano(1000));
    });

    it('Player deposit tJetton', async () => {
        await playerDeposit(player1);
        await playerDeposit(player3);

        const vaultWalletPlayer1 = blockchain.openContract(VaultJettonWallet.createFromAddress(await vaultJetton.getWalletAddressOf(player1.address)));
        let sendUnstake = await vaultJetton.sendUnstake(player1.getSender(), toNano("0.1"), toNano(500));
        printTransactionFees(sendUnstake.transactions);

        const tJettonWalletPlayer1 = await getJettonWallet(blockchain, tJettonMinter.address, player1.address);
        let tJettonBalancePlayer1 = await tJettonWalletPlayer1.getJettonBalance();
        expect(tJettonBalancePlayer1).toEqual(toNano("500"));

        const sendDeposit = await tJettonWalletPlayer1.sendBurn(player1.getSender(), toNano("0.1") + toNano("0.05"), toNano("500"), player1.getSender().address);
        printTransactionFees(sendDeposit.transactions);

        await vaultJetton.getVaultData();
        expect(vaultJetton.info.sJetton_total_deposited).toEqual(toNano(1000));
        expect(vaultJetton.info.tJetton_total_supply).toEqual(0n);
        expect(vaultJetton.info.tJetton_total_staked).toEqual(toNano(1000));

        //  check walletInfo
        const walletInfo = await vaultWalletPlayer1.getWallettData();
        expect(walletInfo.status).toEqual(true);
        expect(walletInfo.tJetton_balance).toEqual(toNano("500"));
    });

    it('Withdraw sJetton and claim reward', async () => {
        await playerDeposit(player1);
        await playerDeposit(player3);

        const vaultWalletPlayer1 = blockchain.openContract(VaultJettonWallet.createFromAddress(await vaultJetton.getWalletAddressOf(player1.address)));
        let sendWithdraw = await vaultJetton.sendWithdraw(player1.getSender(), toNano("0.1"), toNano(500));
        printTransactionFees(sendWithdraw.transactions)

        await vaultJetton.getVaultData();
        expect(vaultJetton.info.sJetton_total_deposited).toEqual(toNano(500));
        expect(vaultJetton.info.tJetton_total_supply).toEqual(0n);
        expect(vaultJetton.info.tJetton_total_staked).toEqual(toNano(500));

        //  check walletInfo
        const walletInfo = await vaultWalletPlayer1.getWallettData();
        expect(walletInfo.status).toEqual(true);
        expect(walletInfo.tJetton_balance).toEqual(toNano("0"));

        let claim = await vaultJetton.sendClaim(player1.getSender(), toNano("0.05"), 1234567n);
        printTransactionFees(claim.transactions)
    });
});
