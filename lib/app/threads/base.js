import APIServices from "#lib/api/services";

export default class {
    #dbh;
    #services;

    constructor ( ...args ) {
        this.#services = new APIServices();
    }

    // static
    static async new ( ...args ) {
        const thread = new this( ...args );

        await thread._init();

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
