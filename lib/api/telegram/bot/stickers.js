export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendsticker
        async sendSticker ( data ) {
            return this._request( "sendSticker", data );
        }

        // https://core.telegram.org/bots/api#getstickerset
        async getStickerSet ( data ) {
            return this._request( "getStickerSet", data );
        }

        // https://core.telegram.org/bots/api#getcustomemojistickers
        async getCustomEmojiStickers ( data ) {
            return this._request( "getCustomEmojiStickers", data );
        }

        // https://core.telegram.org/bots/api#uploadstickerfile
        async uploadStickerFile ( data ) {
            return this._request( "uploadStickerFile", data );
        }

        // https://core.telegram.org/bots/api#createnewstickerset
        async createNewStickerSet ( data ) {
            return this._request( "createNewStickerSet", data );
        }

        // https://core.telegram.org/bots/api#addstickertoset
        async addStickerToSet ( data ) {
            return this._request( "addStickerToSet", data );
        }

        // https://core.telegram.org/bots/api#setstickerpositioninset
        async setStickerPositionInSet ( data ) {
            return this._request( "setStickerPositionInSet", data );
        }

        // https://core.telegram.org/bots/api#deletestickerfromset
        async deleteStickerFromSet ( data ) {
            return this._request( "deleteStickerFromSet", data );
        }

        // https://core.telegram.org/bots/api#setstickeremojilist
        async setStickerEmojiList ( data ) {
            return this._request( "setStickerEmojiList", data );
        }

        // https://core.telegram.org/bots/api#setstickerkeywords
        async setStickerKeywords ( data ) {
            return this._request( "setStickerKeywords", data );
        }

        // https://core.telegram.org/bots/api#setstickermaskposition
        async setStickerMaskPosition ( data ) {
            return this._request( "setStickerMaskPosition", data );
        }

        // https://core.telegram.org/bots/api#setstickersettitle
        async setStickerSetTitle ( data ) {
            return this._request( "setStickerSetTitle", data );
        }

        // https://core.telegram.org/bots/api#setstickersetthumbnail
        async setStickerSetThumbnail ( data ) {
            return this._request( "setStickerSetThumbnail", data );
        }

        // https://core.telegram.org/bots/api#setcustomemojistickersetthumbnail
        async setCustomEmojiStickerSetThumbnail ( data ) {
            return this._request( "setCustomEmojiStickerSetThumbnail", data );
        }

        // https://core.telegram.org/bots/api#deletestickerset
        async deleteStickerSet ( data ) {
            return this._request( "deleteStickerSet", data );
        }
    };
