import Contacts from "./bot/contacts.js";

export default Super =>
    class extends Super {
        #contacts;

        constructor ( ...args ) {
            super( ...args );

            this.#contacts = new Contacts( this );
        }

        // properties
        get contacts () {
            return this.#contacts;
        }
    };
