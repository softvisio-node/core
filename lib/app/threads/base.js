export default class {
    #dbh;

    static async new ( settings ) {
        const thread = new this( settings );

        await thread._init( settings );

        return thread;
    }

    constructor ( settings ) {
        if ( global.host ) global.host.on( "app/settings-update", this._onSettingsUpdate.bind( this ) );
    }

    async _init ( settings ) {
        if ( process.env.APP_DB ) {
            const { "default": sql } = await import( "#lib/sql" );

            this.#dbh = await sql.connect( process.env.APP_DB );
        }
    }

    get dbh () {
        return this.#dbh;
    }

    _onSettingsUpdate ( settings ) {}
}
