export default class Acl {
    #app;
    #config;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#app.dbh;
    }

    get config () {
        return this.#config;
    }

    // public
    async configure () {
        for ( const component of this.app.components ) {
            const acl = component.getAcl();

            if ( !acl ) continue;

            for ( const [name, value] of Object.entries( acl ) ) {
                if ( this.config.acl[name] ) {
                    return result( [400, `API acl "${name}" is already exists`] );
                }

                this.config.acl[name] = value;
            }
        }

        return result( 200 );
    }

    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async start () {
        return result( 200 );
    }

    async shutDown () {
        return result( 200 );
    }

    async sendNotification ( aclId, type, subject, body ) {}
}
