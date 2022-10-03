import ApiServices from "#lib/api/services";
import Notifications from "#lib/app/notifications";
import * as appConfig from "#lib/app/config";

class App {
    #thread;
    #env = {};
    #config;
    #services;
    #notifications;

    constructor ( thread, config ) {
        this.#thread = thread;
        this.#config = appConfig.mergeAppConfig( config );
        this.#services = new ApiServices();

        // init services
        this.#services.addServices();
    }

    // properties
    get config () {
        return this.#config;
    }

    get env () {
        return this.#env;
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
    async _createNotifications () {
        this.#notifications = await Notifications.new( this );
    }
}

export default class {
    #app;
    #dbh;

    constructor ( config ) {
        this.#app = new App( this, config );
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

    get app () {
        return this.#app;
    }

    // protected
    async _init () {

        // init dbh
        if ( process.env.APP_DATABASE ) {
            const { "default": sql } = await import( "#lib/sql" );

            this.#dbh = await sql.new( process.env.APP_DATABASE );
            await this.#dbh.schema.load();

            await this.app._createNotifications();
        }
    }
}
