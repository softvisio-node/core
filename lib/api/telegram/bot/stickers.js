export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendsticker
        async sendSticker ( data ) {}

        // https://core.telegram.org/bots/api#getstickerset
        async getStickerSet ( data ) {}

        // https://core.telegram.org/bots/api#getcustomemojistickers
        async getCustomEmojiStickers ( data ) {}

        // https://core.telegram.org/bots/api#uploadstickerfile
        async uploadStickerFile ( data ) {}

        // https://core.telegram.org/bots/api#createnewstickerset
        async createNewStickerSet ( data ) {}

        // https://core.telegram.org/bots/api#addstickertoset
        async addStickerToSet ( data ) {}

        // https://core.telegram.org/bots/api#setstickerpositioninset
        async setStickerPositionInSet ( data ) {}

        // https://core.telegram.org/bots/api#deletestickerfromset
        async deleteStickerFromSet ( data ) {}

        // https://core.telegram.org/bots/api#setstickeremojilist
        async setStickerEmojiList ( data ) {}

        // https://core.telegram.org/bots/api#setstickerkeywords
        async setStickerKeywords ( data ) {}

        // https://core.telegram.org/bots/api#setstickermaskposition
        async setStickerMaskPosition ( data ) {}

        // https://core.telegram.org/bots/api#setstickersettitle
        async setStickerSetTitle ( data ) {}

        // https://core.telegram.org/bots/api#setstickersetthumbnail
        async setStickerSetThumbnail ( data ) {}

        // https://core.telegram.org/bots/api#setcustomemojistickersetthumbnail
        async setCustomEmojiStickerSetThumbnail ( data ) {}

        // https://core.telegram.org/bots/api#deletestickerset
        async deleteStickerSet ( data ) {}
    };
