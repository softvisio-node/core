import { readConfig } from "#lib/config";
import FirebaseMessaging from "./firebase/messaging.js";

var FIREBASE_ADMIN;

export default class Firebase {
    #app;
    #messaging;

    constructor ( credentials ) {
        if ( typeof credentials === "string" ) credentials = readConfig( credentials );

        this.#app = FIREBASE_ADMIN.initializeApp( {
            "credential": FIREBASE_ADMIN.credential.cert( credentials ),
        } );
    }

    // static
    static async new ( credentials ) {
        FIREBASE_ADMIN ??= (
            await import( "firebase-admin" ).catch( e => {
                throw Error( `firebase-admin package is required` );
            } )
        ).default;

        return new this( credentials );
    }

    // properties
    get app () {
        return this.#app;
    }

    get messaging () {
        this.#messaging ??= new FirebaseMessaging( this );

        return this.#messaging;
    }
}
