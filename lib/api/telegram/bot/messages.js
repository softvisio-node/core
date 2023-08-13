export default Super =>
    class extends Super {

        // XXX
        // https://core.telegram.org/bots/api#sendmessage
        async sendMessage1 () {}

        // https://core.telegram.org/bots/api#forwardmessage
        async forwardMessage () {}

        // https://core.telegram.org/bots/api#copymessage
        async copyMessage () {}

        // https://core.telegram.org/bots/api#sendphoto
        async sendPhoto () {}

        // https://core.telegram.org/bots/api#sendaudio
        async sendAudio () {}

        // https://core.telegram.org/bots/api#senddocument
        async sendDocument () {}

        // https://core.telegram.org/bots/api#sendvideo
        async sendVideo () {}

        // https://core.telegram.org/bots/api#sendanimation
        async sendAnimation () {}

        // https://core.telegram.org/bots/api#sendvoice
        async sendVoice () {}

        // https://core.telegram.org/bots/api#sendvideonote
        async sendVideoNote () {}

        // https://core.telegram.org/bots/api#sendmediagroup
        async sendMediaGroup () {}

        // https://core.telegram.org/bots/api#sendvenue
        async sendVenue () {}

        // https://core.telegram.org/bots/api#sendcontact
        async sendContact () {}

        // https://core.telegram.org/bots/api#senddice
        async sendDice () {}

        // https://core.telegram.org/bots/api#editmessagetext
        async editMessageText () {}

        // https://core.telegram.org/bots/api#editmessagecaption
        async editMessageCaption () {}

        // https://core.telegram.org/bots/api#editmessagemedia
        async editMessageMedia () {}

        // https://core.telegram.org/bots/api#editmessagereplymarkup
        async editMessageReplyMarkup () {}

        // https://core.telegram.org/bots/api#deletemessage
        async deleteMessage () {}
    };
