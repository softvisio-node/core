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

    constructor ( options ) {
        this.#app = new App( this );
    }

    // static
    static async new ( options ) {
        const thread = new this( options );

        await thread.init( options );

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
    async init ( options ) {
        return this._init( options );
    }

    // protected
    async _init ( options ) {}

    async _initDbh ( url, options ) {
        const { "default": sql } = await import( "#lib/sql" );

        this.#dbh = await sql.new( url, options );

        await this.#dbh.schema.load();
    }
}
