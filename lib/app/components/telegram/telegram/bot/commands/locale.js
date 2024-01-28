import Locale from "#lib/locale";

export default Super =>
    class extends Super {

        // public
        getTitle ( ctx ) {
            return this.l10nt( `change communication language` );
        }

        async run ( ctx, req ) {
            if ( !this.bot.locales.canChangeLocale( ctx.user.locale ) ) {
                return this.#onLocaleSet( ctx );
            }
            else {
                return this.#sendKeyboard( ctx );
            }
        }

        async API_setLocale ( ctx, locale ) {
            const res = await ctx.user.setLocale( locale );

            if ( !res.ok ) {
                await ctx.sendText( this.l10nt( `Some error occured, pleast try again.` ) );

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
                    "text": locale.name,
                    "callback_data": this.encodeCallbackData( "setLocale", locale.id ),
                } );
            }

            if ( row.length ) buttons.push( row );

            var res;

            res = await this.#deleteMessage( ctx );

            res = await ctx.sendMessage( {
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

            await ctx.sendDeleteMessage( ctx.state.messageId );

            await ctx.updateState( {
                "messageId": null,
            } );
        }

        async #onLocaleSet ( ctx ) {
            await this.#deleteMessage( ctx );

            await ctx.sendText( this.l10nt( locale => `Communication language set to: ` + new Locale( ctx.user.locale ).name ) );

            return ctx.run( "start" );
        }
    };
