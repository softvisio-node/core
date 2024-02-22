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
    async sendContacts ( ctx ) {
        const res = await this.#getContacts();

        if ( !res.ok ) return res;

        const contacts = res.data;

        // XXX
        contacts.phone = "+380663397273";
        contacts.email = "zdm@softvisio.net";
        contacts.address = "02081, г. Киев, проспект Петра Григоренко 20-А, кв. 55";
        contacts.notes = `sdsa asd asd asd
asd asd asd
asd`;

        const text = l10nt( locale => {
            const text = [];

            if ( this.bot.config.contacts.phoneEnabled && contacts.phone ) {
                text.push( l10n( `<b>Phone` ) + ":</b>\n" + contacts.phone );
            }

            if ( this.bot.config.contacts.emailEnabled && contacts.email ) {
                text.push( l10n( `<b>Email` ) + ":</b>\n" + contacts.email );
            }

            if ( this.bot.config.contacts.addressEnabled && contacts.address ) {
                text.push( l10n( `<b>Address` ) + ":</b>\n" + contacts.address );
            }

            if ( contacts.notes ) {
                text.push( l10n( `<b>Additional info` ) + ":</b>\n" + contacts.notes );
            }

            return text.join( "\n\n" );
        } );

        if ( text ) {
            await ctx.sendMessage( {
                text,
                "parse_mode": "HTML",
            } );
        }

        if ( contacts.latitude && contacts.longitude ) {
            await ctx.send( "sendLocation", {
                "latitude": contacts.latitude,
                "longitude": contacts.longitude,
            } );
        }
    }

    // private
    async #getContacts () {
        return this.dbh.selectRow( SQL.getContacts, [ this.bot.id ] );
    }
}
