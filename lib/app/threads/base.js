import APIServices from "#lib/api/services";
import Notifications from "#lib/app/notifications";

class App {
    #thread;

    constructor ( thread ) {
        this.#thread = thread;
    }

    // properties
    get dbh () {
        return this.#thread.dbh;
    }

    // public
    publish ( ...args ) {
        return global.host.publish( ...args );
    }
}

export default class {
    #app;
    #dbh;
    #services;
    #notifications;

    constructor ( ...args ) {
        this.#app = new App( this );
        this.#services = new APIServices();
        this.#notifications = new Notifications( this.#app );
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

    get notifications () {
        return this.#notifications;
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
