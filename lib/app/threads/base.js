import ApiServices from "#lib/api/services";
import Notifications from "#lib/app/notifications";
import mergeConst from "#lib/app/const";

class App {
    #thread;
    #const;
    #services;
    #notifications;

    constructor ( thread, _const ) {
        this.#thread = thread;
        this.#const = mergeConst( _const );
        this.#services = new ApiServices();

        // init services
        this.#services.addServicesFromEnv();
    }

    static new ( thread, settings ) {
        const app = new App( thread, settings );

        return app;
    }

    // properties
    get const () {
        return this.#const;
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

    // proptected
    _createNotifications () {
        this.#notifications = new Notifications( this );
    }
}

export default class {
    #app;
    #dbh;

    constructor ( _const ) {
        this.#app = App.new( this, _const );
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
            await this.#dbh.loadSchema();

            this.app._createNotifications();
        }
    }
}
