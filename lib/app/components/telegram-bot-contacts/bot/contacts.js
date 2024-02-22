import sql from "#lib/sql";

const SQL = {
    "getContacts": sql`SELECT * FROM telegram_bot_contacts WHERE telegram_bot_id = ?`.prepare(),
};

export default class {
    #bot;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // public
    // XXX
    async getMessage () {
        const res = await this.#getContacts();

        if ( !res.ok ) throw res;

        const text = l10nt( locale => {
            const text = [];

            if ( this.bot.config.contacts.phoneEnabled && res.data.phone ) {
                text.push( l10n( `<b>Phone` ) + ":</b> " + res.data.phone );
            }

            if ( this.bot.config.contacts.emailEnabled && res.data.email ) {
                text.push( l10n( `<b>Email` ) + ":</b> " + res.data.email );
            }

            if ( this.bot.config.contacts.addressEnabled && res.data.address ) {
                text.push( l10n( `<b>Address` ) + ":</b> " + res.data.address );
            }

            if ( res.data.notes ) {
                text.push( l10n( `<b>Additional info` ) + ":</b> " + res.data.notes );
            }

            return text.join( "\n" );
        } );

        return {
            text,
            "parse_mode": "HTML",
        };
    }

    // XXX
    async sendContacts ( ctx ) {
        await ctx.sendMessage( await this.getMessate() );

        await ctx.send( "sendLocation", {
            "latitude": 23,
            "longitude": 43,
        } );
    }

    // private
    async #getContacts () {
        return this.dbh.sekectRow( SQL.getContacts, [ this.bot.id ] );
    }
}
