import sql from "#lib/sql";

const SQL = {
    "getContact": sql`SELECT telegram_bot_contact_id FROM telegram_bot_has_contact WHERE telegram_bot_id = ?`.prepare(),
};

export default Super =>
    class extends Super {
        #contactId;

        // pubjic
        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            res = await this.dbh.selectRow( SQL.getContact, [ this.id ] );
            if ( !res.ok ) return res;

            this.#contactId = res.data.telegram_bot_contact_id;

            return result( 200 );
        }

        async getContact () {
            return this.contacts.get( this.#contactId );
        }
    };
