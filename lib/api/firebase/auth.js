import "#lib/result";

export default class FirebaseAuth {
    #auth;

    constructor ( firebase ) {
        this.#auth = firebase.app.auth();
    }

    // public
    async verifyIdToken ( token ) {
        try {
            const decodedToken = await this.#auth.verifyIdToken( token );

            return result( 200, decodedToken );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }
}
