import Locale from "#lib/locale";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            if ( !this.bot.locales.canChangeLocale( ctx.user.locale ) ) {
                return this.#onLocaleSet( ctx );
            }
            else {
                return this.#sendKeyboard( ctx );
            }
        }

        isEnabled ( ctx ) {
            return this.bot.locales.canChangeLocale( ctx.user.locale );
        }

        getDescription ( ctx ) {
            return l10nt( "change communication language" );
        }

        async [ "API_set_locale" ] ( ctx, locale ) {
            const res = await ctx.user.setLocale( locale );

            if ( !res.ok ) {
                await ctx.sendText( l10nt( "Some error occured. Please, try again." ) );

                await this.#sendKeyboard( ctx );
            }
            else {
                this.#onLocaleSet( ctx );
            }
        }

        // private
        async #sendKeyboard ( ctx ) {
            var buttons = [],
                row = [];

            for ( const locale of this.bot.locales ) {
                if ( row.length === 2 ) {
                    buttons.push( row );

                    row = [];
                }

                row.push( {
                    "text": locale.displayName,
                    "callback_data": this.createCallbackData( "set_locale", locale.id ),
                } );
            }

            if ( row.length ) buttons.push( row );

            var res;

            res = await this.#deleteMessage( ctx );

            res = await ctx.sendMessage( {
                "text": l10nt( "Please, select your communication language:" ),
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
            if ( !ctx.state?.messageId ) return;

            await ctx.user.send( "deleteMessage", { "message_id": ctx.state.messageId } );

            await ctx.updateState( {
                "messageId": undefined,
            } );
        }

        async #onLocaleSet ( ctx ) {
            await this.#deleteMessage( ctx );

            await ctx.sendText( l10nt( locale => "Communication language set to: " + new Locale( ctx.user.locale ).name ) );

            return ctx.run( "start" );
        }
    };
