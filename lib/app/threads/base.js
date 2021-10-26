import ApiServices from "#lib/api/services";
import Notifications from "#lib/app/notifications";

class App {
    #thread;
    #services;
    #notifications;

    constructor ( thread ) {
        this.#thread = thread;
        this.#services = new ApiServices();
        this.#notifications = new Notifications( this );

        // init services
        this.#services.addServicesFromEnv();
    }

    // properties
    get dbh () {
        return this.#thread.dbh;
    }

    get services () {
        return this.#services;
    }

    get notifications () {
        return this.#notifications;
    }

    // public
    publish ( ...args ) {
        return global.host.publish( ...args );
    }
}

export default class {
    #app;
    #dbh;

    constructor ( ...args ) {
        this.#app = new App( this );
    }

    // static
    static async new ( ...args ) {
        const thread = new this( ...args );

        await thread._new();

        return thread;
    }

    // properties
    get dbh () {
        return this.#dbh;
    }

    get app () {
        return this.#app;
    }

    // protected
    async _new () {

        // init dbh
        if ( process.env.APP_DB ) {
            const { "default": sql } = await import( "#lib/sql" );

            this.#dbh = await sql.new( process.env.APP_DB );
        }
    }
}
