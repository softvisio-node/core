import sql from "#lib/sql";

const SQL = {
    "setPhone": sql`UPDATE telegram_bot_contact SET phone = ? WHERE id = ?`.prepare(),

    "setEmail": sql`UPDATE telegram_bot_contact SET email = ? WHERE id = ?`.prepare(),

    "setAddress": sql`UPDATE telegram_bot_contact SET address = ? WHERE id = ?`.prepare(),

    "setNotes": sql`UPDATE telegram_bot_contact SET notes = ? WHERE id = ?`.prepare(),

    "setCoordinates": sql`UPDATE telegram_bot_contact SET latitude = ?, longitude = ? WHERE id = ?`.prepare(),
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

    constructor ( contacts, fields ) {
        this.#contacts = contacts;
        this.#id = fields?.id;

        this.updateFields( fields?.data );
    }

    // priperties
    get but () {
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

    // publuc
    updateFields ( fields ) {
        this.#phone = fields.phone;

        this.#email = fields.email;

        this.#address = fields.address;

        this.#notes = fields.notes;

        this.#latitude = fields.latitude;

        this.#longitude = fields.longitude;
    }

    // XXX
    async save () {}

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

    async setCoordinates ( { latitude, longitude, dbh } = {} ) {
        if ( latitude === this.#latitude && longitude === this.#longitude ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setCoordinates, [ latitude, longitude, this.#id ] );

        if ( res.ok ) {
            this.#latitude = latitude;
            this.#longitude = longitude;
        }

        return res;
    }
}
