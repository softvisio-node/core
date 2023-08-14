export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendsticker
        async sendSticker ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#getstickerset
        async getStickerSet ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#getcustomemojistickers
        async getCustomEmojiStickers ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#uploadstickerfile
        async uploadStickerFile ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#createnewstickerset
        async createNewStickerSet ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#addstickertoset
        async addStickerToSet ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#setstickerpositioninset
        async setStickerPositionInSet ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#deletestickerfromset
        async deleteStickerFromSet ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#setstickeremojilist
        async setStickerEmojiList ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#setstickerkeywords
        async setStickerKeywords ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#setstickermaskposition
        async setStickerMaskPosition ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#setstickersettitle
        async setStickerSetTitle ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#setstickersetthumbnail
        async setStickerSetThumbnail ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#setcustomemojistickersetthumbnail
        async setCustomEmojiStickerSetThumbnail ( data ) {
            return this._request( "", data );
        }

        // https://core.telegram.org/bots/api#deletestickerset
        async deleteStickerSet ( data ) {
            return this._request( "", data );
        }
    };
