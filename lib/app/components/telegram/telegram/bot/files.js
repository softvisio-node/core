import sql from "#lib/sql";

const SQL = {
    "createFile": sql`
SELECT create_telegram_bot_file(
    _telegram_bot_id => ?,
    _file_id => ?,
    _file_unique_id => ?,
    _filename => ?,
    _content_type => ?
) AS id
`.prepare(),

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
    async createFile ( { fileId, fileUniqueId, filename, contentType } = {} ) {
        return this.dbh.selectRow( SQL.createFile, [

            //
            this.bot.id,
            fileId,
            fileUniqueId,
            filename,
            contentType,
        ] );
    }

    async getFile ( id ) {
        try {
            BigInt( id );
        }
        catch ( e ) {
            var fileId = id;
        }

        var res;

        // get file by telegram bot file id
        if ( fileId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileId, [fileId, this.bot.id] );
        }

        // get file by id
        else {
            res = await this.dbh.selectRow( SQL.getFileById, [id, this.bot.id] );
        }

        if ( !res.ok ) return res;

        var file = res.data;

        if ( !file && fileId ) file = { "file_id": fileId };

        if ( !file ) return result( 404 );

        // find downloaded file unique id
        if ( !file.storage_file_id && file.file_unique_id ) {
            res = await this.dbh.selectRow( SQL.getStorageFileId, [file.file_unique_id] );
            if ( !res.ok ) return res;

            file.storage_file_id = res.data?.storage_file_id;
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
            let res1 = await this.app.storage.uploadFile( res.data.file, this.bot.telegram.config.storageLocation + "/" + file.id );

            if ( !res1.ok ) return res1;

            res1 = await this.dbh.do( sql`UPDATE telegram_bot_file SET storage_file_id = ? WHERE id = ?`, [

                //
                res1.data.id,
                file.id,
            ] );

            if ( !res1.ok ) return res1;
        }

        return result( 299, res.data.file );
    }

    // XXX
    async downloadFile ( id, fileId ) {}

    // private
    async #getFile ( fileId ) {
        return this.bot.telegramBotApi.getFile( fileId );
    }
}
