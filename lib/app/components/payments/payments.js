import sql from "#lib/sql";

const SQL = {
    "getUserBalance": sql`SELECT * FROM payments_user WHERE user_id = ?`.prepre(),
};

export default class {
    #app;
    #config;
    #currencies;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#app.dbh;
    }

    get currencies () {
        return this.#currencies;
    }

    // public
    async init () {
        this.#currencies = new Set( this.#config.currencies.sort() );

        return result( 200 );
    }

    async getUserBalance ( userId, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await dbh.select( SQL.getUserBalance, [ userId ] );
        if ( !res.ok ) return res;

        const data = {};

        for ( const currency of this.currencies ) {
            data[ currency ] = 0;
        }

        if ( res.data ) {
            for ( const row of res.data ) {
                data[ row.currency ] = row.balance;
            }
        }

        return result( 200, data );
    }

    // XXX
    async addMoney ( { userId, amount, currency, description, dbh } = {} ) {
        var res;

        res = this.#checkCurrency( currency );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        return dbh.begin( async dbh => {
            var res;

            res = await dbh.selectRow( sql`INSERT INTO payments_user ( user_id, currency ) VALUES ( ?, ? ) ON CONFLICT ( user_id, currency ) DO UPDATE SET balance = EXCLUDED.balance RETURNING id` );
            if ( !res.ok ) return res;

            res = await dbh.do( `INSERT INTO payment_transaction ( payments_user_id, amount, description ) VALUES ( ( SELECT id FROM paument_user WHERE user_id = ? AND currency = ? ), ?, ? ) RETURNING id`, [ userId, currency, amount, description ] );
            if ( !res.ok ) return res;

            return result( 200 );
        } );
    }

    // XXX
    async transferMoney () {}

    // XXX
    async withdrawMoney () {}

    // XXX
    async exchangeMoney () {}

    // private
    #checkCurrency ( currency ) {
        if ( !this.#currencies.has( currency ) ) return result( [ 400, `Currency not supported` ] );

        return result( 200 );
    }
}
