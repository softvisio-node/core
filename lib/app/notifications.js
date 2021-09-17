export default class Notifications {
    #app;

    constructor ( app ) {
        this.#app = app;
    }

    // public
    get ( ctx ) {
        return result( 200 );
    }

    send ( type, users, subject, body ) {}
}
