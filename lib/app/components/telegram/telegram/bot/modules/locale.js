export default Super =>
    class extends Super {

        // public
        async run ( ctx, req ) {

            // var res;

            // res = await ctx.user.setChatCommands();
            // if ( !res.ok ) console.log( res );

            await this.#sendInlineKeyboard( ctx );
        }

        async API_setLocale ( ctx, locale ) {
            const res = await ctx.user.setLocale( locale );

            if ( !res.ok ) {
                await ctx.user.sendText( this.l10nt( `Some error occured, pleast try again.` ) );

                await this.#sendInlineKeyboard( ctx );
            }
            else {
                await this.#deleteMessage( ctx );

                await ctx.user.sendText( this.l10nt( `Communication language was changed` ) );

                return ctx.call( "/" );
            }
        }

        // private
        async #sendInlineKeyboard ( ctx ) {
            var buttons = [],
                row = [];

            for ( const locale of this.bot.locales ) {
                if ( row.length === 2 ) {
                    buttons.push( row );

                    row = [];
                }

                row.push( {
                    "text": locale.name,
                    "callback_data": this.encodeCallbackData( "setLocale", locale.id ),
                } );
            }

            if ( row.length ) buttons.push( row );

            var res;

            // res = await ctx.user.send( "sendMessage", {
            //     "text": this.l10nt( `Please, select your communication language:` ),
            //     "reply_markup": {
            //         "remove_keyboard": true,
            //     },
            // } );

            // await ctx.user.deleteMessage( res.data.message_id );

            res = await this.#deleteMessage( ctx );

            res = await ctx.user.send( "sendMessage", {
                "text": this.l10nt( `Please, select your communication language:` ),
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": buttons,
                },
            } );

            if ( res.ok ) {
                await ctx.updateState( {
                    "messageId": res.data.message_id,
                } );
            }

            return res;
        }

        async #deleteMessage ( ctx ) {
            if ( !ctx.state.messageId ) return;

            await ctx.user.deleteMessage( ctx.state.messageId );

            await ctx.updateState( {
                "messageId": null,
            } );
        }
    };
