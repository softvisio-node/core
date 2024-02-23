import sql from "#lib/sql";
import { mergeObjects } from "#lib/utils";

const SQL = {
    "create": sql`INSERT INTO telegram_bot_contact ( telegram_bot_id ) VALUES ( ? ) RETURNING id`.prepare(),

    "setPhone": sql`UPDATE telegram_bot_contact SET phone = ? WHERE id = ?`.prepare(),

    "setEmail": sql`UPDATE telegram_bot_contact SET email = ? WHERE id = ?`.prepare(),

    "setAddress": sql`UPDATE telegram_bot_contact SET address = ? WHERE id = ?`.prepare(),

    "setNotes": sql`UPDATE telegram_bot_contact SET notes = ? WHERE id = ?`.prepare(),

    "setLocation": sql`UPDATE telegram_bot_contact SET latitude = ?, longitude = ? WHERE id = ?`.prepare(),
};

export default class {
    #contacts;
    #id;
    #phone;
    #email;
    #address;
    #notes;
    #latitude;
    #longitude;

    constructor ( contacts, id, fields ) {
        this.#contacts = contacts;
        this.#id = id;

        if ( fields ) this.updateFields( fields );
    }

    // static
    static async create ( dbh, botId ) {
        return dbh.selectRow( SQL.create, [ botId ] );
    }

    // priperties
    get bot () {
        return this.#contacts.bot;
    }

    get dbh () {
        return this.bot.dbh;
    }

    get id () {
        return this.#id;
    }

    get phone () {
        return this.#phone;
    }

    get email () {
        return this.#email;
    }

    get address () {
        return this.#address;
    }

    get notes () {
        return this.#notes;
    }

    get latitude () {
        return this.#latitude;
    }

    get longitude () {
        return this.#longitude;
    }

    get hasLocation () {
        return this.#latitude && this.#longitude;
    }

    // publuc
    updateFields ( fields ) {
        this.#phone = fields.phone;

        this.#email = fields.email;

        this.#address = fields.address;

        this.#notes = fields.notes;

        this.#latitude = fields.latitude;

        this.#longitude = fields.longitude;
    }

    async setPhone ( value, { dbh } = {} ) {
        if ( value === this.#phone ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setPhone, [ value, this.#id ] );

        if ( res.ok ) this.#phone = value;

        return res;
    }

    async setEmail ( value, { dbh } = {} ) {
        if ( value === this.#email ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setEmail, [ value, this.#id ] );

        if ( res.ok ) this.#email = value;

        return res;
    }

    async setAddress ( value, { dbh } = {} ) {
        if ( value === this.#address ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setAddress, [ value, this.#id ] );

        if ( res.ok ) this.#address = value;

        return res;
    }

    async setNotes ( value, { dbh } = {} ) {
        if ( value === this.#notes ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setNotes, [ value, this.#id ] );

        if ( res.ok ) this.#notes = value;

        return res;
    }

    async setLocation ( { latitude, longitude, dbh } = {} ) {
        if ( latitude === this.#latitude && longitude === this.#longitude ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setLocation, [ latitude, longitude, this.#id ] );

        if ( res.ok ) {
            this.#latitude = latitude;
            this.#longitude = longitude;
        }

        return res;
    }

    // XXX
    // XXX - fields
    async sendContact ( ctx ) {
        const contacts = {};

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
                text.push( l10n( `<b>Phone` ) + ":</b> " + contacts.phone );
            }

            if ( this.bot.config.contacts.emailEnabled && contacts.email ) {
                text.push( l10n( `<b>Email` ) + ":</b> " + contacts.email );
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
    }

    async sendLocation ( ctx, data ) {
        if ( !this.hasLocation ) return result( 200 );

        data = mergeObjects( {}, data, {
            "latitude": this.#latitude,
            "longitude": this.#longitude,
        } );

        return ctx.send( "sendLocation", data );
    }
}
