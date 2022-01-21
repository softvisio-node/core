import ApiServices from "#lib/api/services";
import Notifications from "#lib/app/notifications";
import mergeConfig from "#lib/app/config";

class App {
    #thread;
    #config;
    #services;
    #notifications;

    constructor ( thread, config ) {
        this.#thread = thread;
        this.#config = mergeConfig( config );
        this.#services = new ApiServices();

        // init services
        this.#services.addServicesFromEnv();
    }

    static new ( thread, settings ) {
        const app = new App( thread, settings );

        return app;
    }

    // properties
    get config () {
        return this.#config;
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
    on ( ...args ) {
        return global.host.on( ...args );
    }

    once ( ...args ) {
        return global.host.once( ...args );
    }

    off ( ...args ) {
        return global.host.off( ...args );
    }

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

    constructor ( config ) {
        this.#app = App.new( this, config );
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
            await this.#dbh.schema.load();

            this.app._createNotifications();
        }
    }
}
