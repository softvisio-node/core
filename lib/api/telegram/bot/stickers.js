export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendsticker
        async sendSticker () {}

        // https://core.telegram.org/bots/api#getstickerset
        async getStickerSet () {}

        // https://core.telegram.org/bots/api#getcustomemojistickers
        async getCustomEmojiStickers () {}

        // https://core.telegram.org/bots/api#uploadstickerfile
        async uploadStickerFile () {}

        // https://core.telegram.org/bots/api#createnewstickerset
        async createNewStickerSet () {}

        // https://core.telegram.org/bots/api#addstickertoset
        async addStickerToSet () {}

        // https://core.telegram.org/bots/api#setstickerpositioninset
        async setStickerPositionInSet () {}

        // https://core.telegram.org/bots/api#deletestickerfromset
        async deleteStickerFromSet () {}

        // https://core.telegram.org/bots/api#setstickeremojilist
        async setStickerEmojiList () {}

        // https://core.telegram.org/bots/api#setstickerkeywords
        async setStickerKeywords () {}

        // https://core.telegram.org/bots/api#setstickermaskposition
        async setStickerMaskPosition () {}

        // https://core.telegram.org/bots/api#setstickersettitle
        async setStickerSetTitle () {}

        // https://core.telegram.org/bots/api#setstickersetthumbnail
        async setStickerSetThumbnail () {}

        // https://core.telegram.org/bots/api#setcustomemojistickersetthumbnail
        async setCustomEmojiStickerSetThumbnail () {}

        // https://core.telegram.org/bots/api#deletestickerset
        async deleteStickerSet () {}
    };
