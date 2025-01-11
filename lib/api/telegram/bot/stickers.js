export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendsticker
        async sendSticker ( data ) {
            return this._doRequest( "sendSticker", data );
        }

        // https://core.telegram.org/bots/api#getstickerset
        async getStickerSet ( data ) {
            return this._doRequest( "getStickerSet", data );
        }

        // https://core.telegram.org/bots/api#getcustomemojistickers
        async getCustomEmojiStickers ( data ) {
            return this._doRequest( "getCustomEmojiStickers", data );
        }

        // https://core.telegram.org/bots/api#uploadstickerfile
        async uploadStickerFile ( data ) {
            return this._doRequest( "uploadStickerFile", data );
        }

        // https://core.telegram.org/bots/api#createnewstickerset
        async createNewStickerSet ( data ) {
            return this._doRequest( "createNewStickerSet", data );
        }

        // https://core.telegram.org/bots/api#addstickertoset
        async addStickerToSet ( data ) {
            return this._doRequest( "addStickerToSet", data );
        }

        // https://core.telegram.org/bots/api#setstickerpositioninset
        async setStickerPositionInSet ( data ) {
            return this._doRequest( "setStickerPositionInSet", data );
        }

        // https://core.telegram.org/bots/api#deletestickerfromset
        async deleteStickerFromSet ( data ) {
            return this._doRequest( "deleteStickerFromSet", data );
        }

        // https://core.telegram.org/bots/api#setstickeremojilist
        async setStickerEmojiList ( data ) {
            return this._doRequest( "setStickerEmojiList", data );
        }

        // https://core.telegram.org/bots/api#setstickerkeywords
        async setStickerKeywords ( data ) {
            return this._doRequest( "setStickerKeywords", data );
        }

        // https://core.telegram.org/bots/api#setstickermaskposition
        async setStickerMaskPosition ( data ) {
            return this._doRequest( "setStickerMaskPosition", data );
        }

        // https://core.telegram.org/bots/api#setstickersettitle
        async setStickerSetTitle ( data ) {
            return this._doRequest( "setStickerSetTitle", data );
        }

        // https://core.telegram.org/bots/api#setstickersetthumbnail
        async setStickerSetThumbnail ( data ) {
            return this._doRequest( "setStickerSetThumbnail", data );
        }

        // https://core.telegram.org/bots/api#setcustomemojistickersetthumbnail
        async setCustomEmojiStickerSetThumbnail ( data ) {
            return this._doRequest( "setCustomEmojiStickerSetThumbnail", data );
        }

        // https://core.telegram.org/bots/api#deletestickerset
        async deleteStickerSet ( data ) {
            return this._doRequest( "deleteStickerSet", data );
        }
    };
