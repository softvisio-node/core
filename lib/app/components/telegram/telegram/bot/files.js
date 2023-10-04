import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";

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

    "getFileByFileUniqueId": sql`
SELECT DISTINCT ON ( id )
    *
FROM
    telegram_bot_file
WHERE
    file_unique_id = ?
`.prepare(),

    "getStorageFileId": sql`SELECT storage_file_id FROM telegram_bot_file WHERE file_unique_id = ? AND storage_file_id IS NOT NULL`.prepare(),
};

export default class TelegramBotFiles {
    #bot;
    #mutexSet = new Mutex.Set();

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
    // XXX shared mutex ???
    // XXX cache ???
    async getFile ( { id, fileId, fileUniqueId } = {} ) {
        var res, file;

        if ( id ) {
            res = await this.dbh.selectRow( SQL.getFileById, [id, this.bot.id] );
            if ( !res.ok ) return res;

            file = res.data;
        }

        if ( !file && fileId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileId, [fileId, this.bot.id] );
            if ( !res.ok ) return res;

            file = res.data;
        }

        // XXX prefer current bot id
        if ( !file && fileUniqueId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileUniqueId, [fileUniqueId] );
            if ( !res.ok ) return res;

            file = res.data;
        }

        if ( !file ) return result( 404 );

        if ( !file.storage_file_id ) {
            res = await this.dbh.selectRow( SQL.getStorageFileId, [file.file_unique_id] );
            if ( !res.ok ) return res;

            file.storage_file_id = res.data.storage_file_id;
        }

        if ( file.storage_file_id ) {
            return this.app.storage.getFile( file.storage_file_id );
        }

        if ( file.telegram_bot_id !== this.bot.id ) {
            return result( 404 );
        }
    }

    async downloadFile () {}

    // private
    async #downloadFile ( fileId, fileUniqueId ) {
        return this.bot.telegramApi.getFile( fileId );
    }
}
