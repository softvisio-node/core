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
        return this.#request( "post", "order", {
            storageApiKey,
            "body": {
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
            },
        } );
    }

    // https://docs.wallet.tg/pay/#tag/Order/operation/getPreview
    async getOrder ( orderId, { storageApiKey } = {} ) {
        return this.#request( "get", "order/preview", {
            storageApiKey,
            "params": {
                "id": orderId,
            },
        } );
    }

    // https://docs.wallet.tg/pay/#tag/Order-Reconciliation/operation/getOrderList
    async getOrdersList ( { storageApiKey, offset, count } = {} ) {
        return this.#request( "get", "reconciliation/order-list", {
            storageApiKey,
            "params": {
                "offset": offset || 0,
                "count": count || 999,
            },
        } );
    }

    // https://docs.wallet.tg/pay/#tag/Order-Reconciliation/operation/getOrderAmount
    async getOrdersCount ( { storageApiKey } = {} ) {
        return this.#request( "get", "reconciliation/order-amount", {
            storageApiKey,
        } );
    }

    // private
    async #request ( method, path, { storageApiKey, params, body } = {} ) {
        const url = new URL( `https://pay.wallet.tg/wpay/store-api/v${ API_VERSIOB }/${ path }` );

        if ( params ) {
            for ( const [ key, value ] of Object.entries( params ) ) {
                if ( value == null ) continue;

                url.searchParams.set( key, value );
            }
        }

        const headers = {
            "Wpay-Store-Api-Key": storageApiKey || this.#storageApiKey,
            "accept": "application/json",
        };

        if ( body ) {
            headers[ "content-type" ] = "application/json";
        }

        const res = await fetch( url, {
            method,
            headers,
            "body": body
                ? JSON.stringify( body )
                : null,
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
