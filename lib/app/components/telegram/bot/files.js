export default class TelegramBotFiles {
    #bot;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.#bot.app;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // public
    async getFile ( fileId ) {
        return this.bot.api.getFile( fileId );
    }

    async downloadFile ( req, fileId ) {
        return this.bot.api.downloadFile( req, fileId, "public, max-age=30672000" );
    }

    async downloadAvatar ( req, telegramUserId ) {
        var userId;

        if ( telegramUserId ) {
            const user = await this.bot.users.getById( telegramUserId );

            // user not found
            if ( !user ) return req.end( 404 );

            userId = user.id;
        }
        else {
            userId = this.bot.id;
        }

        var res;

        res = await this.bot.api.getUserProfilePhotos( {
            "user_id": userId,
            "offset": 0,
            "limit": 1,
        } );

        if ( !res.ok ) return this.app.api.downloadDefaultAvatar( req );

        const fileId = res.data.photos?.[ 0 ]?.[ 0 ]?.file_id;

        if ( !fileId ) return this.app.api.downloadDefaultAvatar( req );

        return this.bot.api.downloadFile( req, fileId, this.app.api.avatarCacheControl );
    }
}
