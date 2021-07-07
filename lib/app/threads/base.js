import APIHub from "#lib/api/hub";

export default class {
    #dbh;
    #settings;
    #services;

    constructor ( settings ) {
        this.#settings = settings;
        this.#services = new APIHub();
    }

    // static
    static async new ( settings ) {
        const thread = new this( settings );

        await thread._init();

        return thread;
    }

    // properties
    get settings () {
        return this.#settings;
    }

    get dbh () {
        return this.#dbh;
    }

    get services () {
        return this.#services;
    }

    // protected
    async _init () {

        // init dbh
        if ( process.env.APP_DB ) {
            const { "default": sql } = await import( "#lib/sql" );

            this.#dbh = await sql.new( process.env.APP_DB );
        }

        // init services
        this.#services.addServicesFromEnv();
    }
}
