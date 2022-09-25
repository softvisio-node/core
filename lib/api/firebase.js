import { readConfig } from "#lib/config";
import FirebaseAuth from "./firebase/auth.js";
import FirebaseMessaging from "./firebase/messaging.js";

var FIREBASE_ADMIN;

export default class Firebase {
    #app;
    #auth;
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

    get auth () {
        this.#auth ??= new FirebaseAuth( this );

        return this.#auth;
    }

    get messaging () {
        this.#messaging ??= new FirebaseMessaging( this );

        return this.#messaging;
    }
}
