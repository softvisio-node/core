export default Super =>
    class extends Super {

        // public
        run ( ctx, req ) {
            if ( ctx.permissions.has( "telegram/bot/chat" ) ) {
                return this.#messageFromUser( ctx, req );
            }
            else {
                return this.#messageFromCustomer( ctx, req );
            }
        }

        // private
        // XXX
        async #messageFromUser ( ctx, req ) {}

        // XXX
        async #messageFromCustomer ( ctx, req ) {}
    };
