import fetch from "#lib/fetch";

const API_VERSIOB = 1;

// NOTE https://docs.wallet.tg/pay/

export default class TelegramWalletPay {
    #storageApiKey;

    constructor ( storageApiKey ) {
        this.#storageApiKey = storageApiKey;
    }

    // properties
    get storageApiKey () {
        return this.#storageApiKey;
    }

    // public
    // https://docs.wallet.tg/pay/#tag/Order/operation/create
    async createOrder ( { storageApiKey, amount, currencyCode, description, externalId, customerTelegramUserId, timeoutSeconds, autoConversionCurrency, returnUrl, failReturnUrl, customData } ) {
        const res = await fetch( `https://pay.wallet.tg/wpay/store-api/v${ API_VERSIOB }/order`, {
            "method": "post",
            "headers": {
                "Wpay-Store-Api-Key": storageApiKey || this.#storageApiKey,
                "content-type": "application/json",
                "accept": "application/json",
            },
            "body": JSON.stringify( {
                "amount": {
                    currencyCode,
                    amount,
                },
                description,
                externalId,
                customerTelegramUserId,
                timeoutSeconds,
                "autoConversionCurrency": autoConversionCurrency || null,
                "returnUrl": returnUrl || null,
                "failReturnUrl": failReturnUrl || null,
                "customData": customData || null,
            } ),
        } );

        const data = await res.json();

        if ( !res.ok ) {
            return result( [ res.status, data.status ], data );
        }
        else {
            return result( 200, data );
        }
    }
}
