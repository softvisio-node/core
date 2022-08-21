export default class FirebaseMessaging {
    #messaging;

    constructor ( firebase ) {
        this.#messaging = firebase.app.messaging();
    }

    // public
    async send ( message ) {
        const res = await this.#messaging.send( message );

        return res;
    }

    async subscribeToTopic ( topic, tokens ) {
        if ( !Array.isArray( tokens ) ) tokens = [tokens];

        const res = await this.#messaging.subscribeToTopic( tokens, topic );

        return res;
    }

    async unsubscribeFromTopic ( topic, tokens ) {
        if ( !Array.isArray( tokens ) ) tokens = [tokens];

        const res = await this.#messaging.unsubscribeFromTopic( tokens, topic );

        return res;
    }
}
