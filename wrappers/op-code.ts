import * as crc32 from 'crc-32';

function calOp(str: string): number {
    return Number(BigInt(crc32.str(str)) & 0xffffffffn);
}
export abstract class Op {
    static mint = calOp('mint');
    static request_mint_tJetton = calOp('request_mint_tJetton');
    static call_to_without_ref = calOp('call_to_without_ref');
    static call_to = calOp('call_to');
    static upgrade_code = calOp('upgrade_code');
    static update_sJetton_config = calOp('update_sJetton_config');
    static change_admin = calOp('change_admin');
    static claim_admin = calOp('claim_admin');
    static change_content = calOp('change_content');
    static upgrade = calOp('upgrade');
    static upgrade_wallet_code = calOp('upgrade_wallet_code');
    static upgrade_oracle = calOp('upgrade_oracle');
    static set_data_for_wallet = calOp('set_data_for_wallet');
    static open = calOp('open');
    static deposit = calOp('deposit');
    static profit = calOp('profit');
    static reimburse = calOp('reimburse');
    static execute_withdraw = calOp('execute_withdraw');
    static unstake = calOp('unstake');
    static request_withdraw = calOp('request_withdraw');
    static request_stake = calOp('request_stake');
    static claim = calOp('claim');
    static claim_notification = calOp('claim_notification');
    static upgrade_jetton_wallet_code = calOp('upgrade_jetton_wallet_code');
    static transfer_notification = 0x7362d09c;
    static internal_transfer = 0x178d4519;
    static excesses = 0xd53276db;
    static burn = 0x595f07bc;
    static burn_notification = 0x7bdd97de;
    static provide_wallet_address = 0x2c76b973;
    static take_wallet_address = 0xd1735400;
    static burnJetton = 0x595f07bc;
    static transfer = 0xf8a7ea5;
}

export abstract class Errors {
    static workchain = 103;
    static invalid_op = 0xffff;
    static invalid_sender = 4001;
    static not_open = 4002;
    static deposit_amount_too_low = 4003;
    static insufficient_fee = 4004;
    static insufficient_balance = 4005;
    static invalid_admin_jetton_minter = 73;
    static invalid_jetton_wallet = 74;
    static insufficient_fee_provide_wallet_address = 75;
    static invalid_owner_jetton_wallet = 705;
    static invalid_balance_less_zero = 706;
    static sender_is_not_minnter = 707;
    static invalid_in_msg_body = 708;
    static invalid_msg_value_jetton_wallet_or_invalid_op = 709;
    static Stack_underflow = 2;
    static Stack_overflow = 3;
    static Integer_overflow = 4;
    static Integer_out_of_expected_range = 5;
    static Invalid_opcode = 6;
    static Type_check_error = 7;
    static Cell_overflow = 8;
    static Cell_underflow = 9;
    static Dictionary_error = 10;
    static contract_locked = 45;
    static balance_error = 47;
    static not_enough_gas = 48;
    static invalid_message = 49;
    static not_enough_collateral = 50;
    static not_owner = 55;
}
