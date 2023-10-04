import sql from "#lib/sql";

const SQL = {
    "getFileById": sql`
SELECT DISTINCT ON ( id )
    *
FROM
    telegram_bot_file
WHERE
    id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getFileByFileId": sql`
SELECT DISTINCT ON ( id )
    *
FROM
    telegram_bot_file
WHERE
    file_id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getStorageFileId": sql`SELECT storage_file_id FROM telegram_bot_file WHERE file_unique_id = ? AND storage_file_id IS NOT NULL`.prepare(),
};

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
    async createFile ( { fileId, fileUniqueId, filename, contentType } = {} ) {}

    // XXX shared mutex ???
    // XXX cache ???
    async getFile ( id ) {
        try {
            var fileId = BigInt( id ).toString();
        }
        catch ( e ) {}

        var res;

        // get file by id
        if ( id ) {
            res = await this.dbh.selectRow( SQL.getFileById, [id, this.bot.id] );
        }

        // get file by telegram file id
        else {
            res = await this.dbh.selectRow( SQL.getFileByFileId, [fileId, this.bot.id] );
        }

        if ( !res.ok ) return res;

        var file = res.data;

        if ( !file && fileId ) file = { "file_id": fileId };

        if ( !file ) return result( 404 );

        // find downloaded file unique id
        if ( !file.storage_file_id && file.file_unique_id ) {
            res = await this.dbh.selectRow( SQL.getStorageFileId, [file.file_unique_id] );
            if ( !res.ok ) return res;

            file.storage_file_id = res.data.storage_file_id;
        }

        // file already exists in the storage
        if ( file.storage_file_id ) {
            res = await this.app.storage.getFile( file.storage_file_id );
            if ( !res.ok ) return res;

            if ( file.filename ) res.data.file.name = file.filename;
            if ( file.content_type ) res.data.file.type = file.content_type;

            return result( 200, res.data.file );
        }

        // download file
        res = await this.#getFile( file.file_id );
        if ( !res.ok ) return res;

        if ( file.filename ) res.data.file.name = file.filename;
        if ( file.content_type ) res.data.file.type = file.content_type;

        // store file
        if ( file.id ) {

            // XXX
            // await this.app.storage.yploadFile( res.data.file, this.bot.telegram.config.storageLocation + "/" + file.id );
        }

        return result( 299, res.data.file );
    }

    async downloadFile () {}

    // private
    async #getFile ( fileId ) {
        return this.bot.telegramApi.getFile( fileId );
    }
}
