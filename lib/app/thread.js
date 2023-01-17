class App {
    #thread;

    constructor ( thread ) {
        this.#thread = thread;
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
}

export default class {
    #app;
    #dbh;

    constructor ( config ) {
        this.#app = new App( this );
    }

    // static
    static async new ( ...args ) {
        const thread = new this( ...args );

        await thread.init();

        return thread;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#dbh;
    }

    // public
    async init () {
        return this._init();
    }

    // protected
    async _init () {}

    async _initDbh ( url ) {
        const { "default": sql } = await import( "#lib/sql" );

        this.#dbh = await sql.new( url );

        await this.#dbh.schema.load();
    }
}
