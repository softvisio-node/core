import "#lib/result";

export default class FirebaseMessaging {
    #messaging;

    constructor ( firebase ) {
        this.#messaging = firebase.app.messaging();
    }

    // public
    async send ( message ) {
        try {
            const res = await this.#messaging.send( message );

            return result( 200, res );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async subscribeToTopic ( topic, tokens ) {
        try {
            const res = await this.#messaging.subscribeToTopic( tokens, topic );

            return result( 200, res );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async unsubscribeFromTopic ( topic, tokens ) {
        try {
            const res = await this.#messaging.unsubscribeFromTopic( tokens, topic );

            return result( 200, res );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }
}
