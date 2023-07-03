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
    async init () {
        return result( 200 );
    }

    async start () {
        return result( 200 );
    }

    async shutDown () {
        return result( 200 );
    }

    async addAcl ( acl ) {}

    async sendNotification ( aclId, type, subject, body ) {}
}
