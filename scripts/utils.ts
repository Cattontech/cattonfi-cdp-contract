import path from "path"
import fs = require('fs')
import { Address, beginCell, Cell, Dictionary } from "@ton/core";
const axios = require('axios');

export function saveDeployInfo(name: string, data: any, network: string) {
    const folder = path.join(process.cwd(), 'deployInfo', network)
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify(data, null, 2))
    console.log(`--- Save data contract ${name} done ---`);
}

export function loadDeployInfo(name: string, network: string): string {
    const folder = path.join(process.cwd(), 'deployInfo', network, `${name}.json`);
    const data = fs.readFileSync(folder, 'utf8');
    return JSON.parse(data).address
}

export function stringToBase64ToHex(originalBase64: string): string {
    try {
        const base64UrlSafe = originalBase64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const buffer = Buffer.from(base64UrlSafe, "base64");
        return buffer.toString("hex");
    } catch (error) {
        console.log(error);
        throw error
    }
}

export function getFriendlyAddress(address: string | Address): string {
    if (typeof address === 'string') {
        address = Address.parse(address);
    }
    return address.toString({
        bounceable: true,
        urlSafe: true,
        testOnly: false,
    });
}

export function fromNano6(src: string | number | bigint): string {
    let v = BigInt(src); // Chuyển đổi đầu vào thành BigInt
    let neg = false;

    // Xử lý số âm
    if (v < 0) {
        neg = true;
        v = -v;
    }

    // Xử lý phần lẻ (fraction)
    let frac = v % 1000000n;
    let fracStr = frac.toString();
    while (fracStr.length < 6) {
        fracStr = '0' + fracStr;
    }
    // Cắt bỏ các số 0 ở cuối
    fracStr = fracStr.match(/^([0-9]*[1-9]|0)(0*)/)![1];

    // Xử lý phần nguyên (whole)
    let whole = v / 1000000n;
    let wholeStr = whole.toString();

    // Tạo giá trị cuối cùng
    let value = `${wholeStr}${fracStr === '0' ? '' : `.${fracStr}`}`;
    if (neg) {
        value = '-' + value;
    }

    return value;
}

export function toNano6(src: string | number | bigint) {
    if (typeof src === 'bigint') {
        return src * 1000000n;
    }
    else {
        if (typeof src === 'number') {
            if (!Number.isFinite(src)) {
                throw Error('Invalid number');
            }
            if (Math.log10(src) <= 6) {
                src = src.toLocaleString('en', { minimumFractionDigits: 6, useGrouping: false });
            }
            else if (src - Math.trunc(src) === 0) {
                src = src.toLocaleString('en', { maximumFractionDigits: 0, useGrouping: false });
            }
            else {
                throw Error('Not enough precision for a number value. Use string value instead');
            }
        }
        // Check sign
        let neg = false;
        while (src.startsWith('-')) {
            neg = !neg;
            src = src.slice(1);
        }
        // Split string
        if (src === '.') {
            throw Error('Invalid number');
        }
        let parts = src.split('.');
        if (parts.length > 2) {
            throw Error('Invalid number');
        }
        // Prepare parts
        let whole = parts[0];
        let frac = parts[1];
        if (!whole) {
            whole = '0';
        }
        if (!frac) {
            frac = '0';
        }
        if (frac.length > 6) {
            throw Error('Invalid number');
        }
        while (frac.length < 6) {
            frac += '0';
        }
        // Convert
        let r = BigInt(whole) * 1000000n + BigInt(frac);
        if (neg) {
            r = -r;
        }
        return r;
    }
}

export function getBounceableAddress(address: string | Address): string {
    if (typeof address === 'string') {
        address = Address.parse(address);
    }
    return address.toString({
        bounceable: false,
        urlSafe: true,
        testOnly: false,
    });
}