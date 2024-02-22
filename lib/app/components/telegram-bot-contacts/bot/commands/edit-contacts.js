export default Super =>
    class extends Super {

        // public
        getDescription ( ctx ) {
            return l10nt( `edit start your contacts` );
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        async run ( ctx, requestMessage ) {

            // await this.bot.contacts.sendContacts( ctx );

            const contacts = {
                "phone": "+232332233432",
            };

            await ctx.sendMessage( {
                "text": l10nt( msgid`Phone: ${ contacts.phone }` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( "Edit phone" ),
                                "callback_data": this.encodeCallbackData( "editPhone" ),
                            },
                            {
                                "text": l10nt( "Delete phone" ),
                                "callback_data": this.encodeCallbackData( "deletePhone" ),
                            },
                        ],
                    ],
                },
            } );

            await ctx.sendMessage( {
                "text": l10nt( msgid`Email: ${ contacts.phone }` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( "Edit email" ),
                                "callback_data": this.encodeCallbackData( "editPhone" ),
                            },
                            {
                                "text": l10nt( "Delete email" ),
                                "callback_data": this.encodeCallbackData( "deletePhone" ),
                            },
                        ],
                    ],
                },
            } );
        }
    };
