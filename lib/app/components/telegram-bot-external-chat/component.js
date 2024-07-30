export default Super =>
    class extends Super {

        // protected
        async _init () {
            var res;

            res = await super._init();
            if ( !res.ok ) return res;

            // init db
            res = await this.app.dbh.schema.migrate( new URL( "db", import.meta.url ) );
            if ( !res.ok ) return res;

            return result( 200 );
        }

        async _start () {
            const res = await super._start();
            if ( !res.ok ) return res;

            this.app.dbh.on( "telegram-bot-external-chat/update", data => {
                const bot = this.instanse.bots.getBotById( data.telegram_bot_id );

                if ( !bot ) return;

                bot.externalChat?.updateFields( data );
            } );

            return result( 200 );
        }
    };
