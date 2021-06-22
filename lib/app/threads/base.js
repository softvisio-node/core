import APIHub from "#lib/api/hub";

export default class {
    #dbh;
    #services;

    constructor ( settings ) {
        this.#services = new APIHub();

        if ( global.host ) global.host.on( "api/settings-update", this._onSettingsUpdate.bind( this ) );
    }

    // static
    static async new ( settings ) {
        const thread = new this( settings );

        await thread._init( settings );

        return thread;
    }

    // properties
    get dbh () {
        return this.#dbh;
    }

    get services () {
        return this.#services;
    }

    // protected
    async _init ( settings ) {

        // init dbh
        if ( process.env.APP_DB ) {
            const { "default": sql } = await import( "#lib/sql" );

            this.#dbh = await sql.connect( process.env.APP_DB );
        }

        // init services
        this.#services.addServicesFromEnv();
    }

    _onSettingsUpdate ( settings ) {}
}
