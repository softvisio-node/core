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

        // XXX
        const config = this.bot.config.botContact;

        const text = l10nt( locale => {
            const text = [];

            if ( config.phoneEnabled && this.phone ) {
                text.push( "<b>P" + l10n( `hone` ) + ":</b> " + this.phone );
            }

            if ( config.emailEnabled && this.email ) {
                text.push( "<b>P" + l10n( `Email` ) + ":</b> " + this.email );
            }

            if ( config.addressEnabled && this.address ) {
                text.push( "<b>P" + l10n( `Address` ) + ":</b>\n" + this.address );
            }

            if ( config.notesEnabled && this.notes ) {
                text.push( "<b>P" + l10n( `Notes` ) + ":</b>\n" + this.notes );
            }

            return text.join( "\n\n" );
        } );

        await ctx.sendMessage( {
            text,
            "parse_mode": "HTML",
        } );
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
