import ApiServices from "#lib/api/services";
import Notifications from "#lib/app/notifications";

class App {
    #thread;
    #settings;
    #services;
    #notifications;

    constructor ( thread, settings ) {
        this.#thread = thread;
        this.#settings = settings;
        this.#services = new ApiServices();

        // init services
        this.#services.addServicesFromEnv();
    }

    static new ( thread, settings ) {
        const app = new App( thread, settings );

        return app;
    }

    // properties
    get settings () {
        return this.#settings;
    }

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

    createNotifications () {
        this.#notifications = new Notifications( this );
    }
}

export default class {
    #app;
    #dbh;

    constructor ( appSettings ) {
        this.#app = App.new( this, appSettings );
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

            this.app.createNotifications();
        }
    }
}
