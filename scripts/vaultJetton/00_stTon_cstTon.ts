import { Address, address, beginCell, Cell, Dictionary, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { sha256_sync } from '@ton/crypto';
import { JettonMinter } from '../../wrappers/JettonMinter';
import { getBounceableAddress, loadDeployInfo, saveDeployInfo } from '../utils';
export type TokenMetadata = {
    image?: string;
    name?: string;
    symbol?: string;
    description?: string;
    decimals?: string;
};

function stringHash(val: string) {
    return BigInt('0x' + sha256_sync(val).toString('hex'));
}

function storeSnakeContentData(str: string) {
    return beginCell().storeUint(0, 8).storeStringTail(str).endCell();
}

function storeHashmapContentData(meta: TokenMetadata) {
    const hashmap_content = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    for (const [key, val] of Object.entries(meta)) {
        val != null && hashmap_content.set(stringHash(key), storeSnakeContentData(val));
    }
    return hashmap_content;
}

export function createTokenOnchainMetadata(meta: TokenMetadata) {
    const hashmap_content = storeHashmapContentData(meta);
    return beginCell().storeUint(0, 8).storeDict(hashmap_content).endCell();
}

export async function run(provider: NetworkProvider) {
    await deploy(provider);
    // await updateContent(provider);
}

export async function deploy(provider: NetworkProvider) {
    const jettonCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');
    const vaultWalletCode = await compile('VaultJettonWallet');

    {
        const meta = {
            decimals: '9',
            symbol: 'stTON',
            name: 'stTon',
            description: 'Token test',
            image: 'https://cache.tonapi.io/imgproxy/BBswWn_XyuF6aNntVmh-yXANFKQ_PkUpt30z-kotVvg/rs:fill:200:200:1/g:no/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL21pbGtjcmVlay90b2tlbnMvc3RUT04ucG5n.webp',
        };
        const content = createTokenOnchainMetadata(meta);

        const jettonMinter = provider.open(
            JettonMinter.createFromConfig(
                {
                    walletCode: jettonWalletCode,
                    admin: provider.sender().address || Address.parse('0'),
                    content: content,
                    vaultWalletCode
                },
                jettonCode,
            ),
        );
        await jettonMinter.sendDeploy(provider.sender(), toNano('0.1'));

        await provider.waitForDeploy(jettonMinter.address);

        let saveInfo = {
            metadata: meta,
            address: getBounceableAddress(jettonMinter.address),
        };
        saveDeployInfo('stTon', saveInfo, provider.network());
    }

    {
        const meta = {
            decimals: '9',
            symbol: 'cstTON',
            name: 'cstTon',
            description: 'Token test',
            image: 'https://cache.tonapi.io/imgproxy/gBmKmfWmjkjuH6uKqFT6_icGxp7LjBdBFOhusJcze2g/rs:fill:200:200:1/g:no/aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL1NoYWRvd1RpL3Rva2VuX3NvbnlhL21haW4vTE9HT18yNTZfMjU2LnBuZw.webp',
        };
        const content = createTokenOnchainMetadata(meta);

        const jettonMinter = provider.open(
            JettonMinter.createFromConfig(
                {
                    walletCode: jettonWalletCode,
                    admin: provider.sender().address || Address.parse('0'),
                    content: content,
                    vaultWalletCode
                },
                jettonCode,
            ),
        );

        await jettonMinter.sendDeploy(provider.sender(), toNano('0.1'));

        await provider.waitForDeploy(jettonMinter.address);

        let saveInfo = {
            metadata: meta,
            address: getBounceableAddress(jettonMinter.address),
        };
        saveDeployInfo('cstTon', saveInfo, provider.network());
    }
}