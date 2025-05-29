import Api from "#lib/api";

const DEFAULT_API_URL = "ws://whisper:81/api";

export default class WhisperApi {
    #api;

    constructor ( apiUrl ) {
        this.#api = new Api( apiUrl || DEFAULT_API_URL );
    }

    // public
    async getModels () {
        return this.#api.call( "whisper/get-models" );
    }

    async getInstalledModels () {
        return this.#api.call( "whisper/get-installed-models" );
    }

    async installModel ( model, { force } = {} ) {
        return this.#api.call( "whisper/install-model", model, { "force": Boolean( force ) } );
    }

    async deleteModel ( model ) {
        return this.#api.call( "whisper/delete-model", model );
    }

    async detectLanguage ( audioFile, { model } = {} ) {
        return this.#api
            .upload( {
                "method": "whisper/detect=language",
                "args": [
                    audioFile,
                    {
                        "model": model ?? "",
                    },
                ],
                "headersTimeout": 0,
            } )
            .start();
    }

    async transformSpeechToText ( audioFile, { model, language } = {} ) {
        return this.#api
            .upload( {
                "method": "whisper/transform-speech-to-text",
                "args": [
                    audioFile,
                    {
                        "model": model ?? "",
                        "language": language ?? "",
                    },
                ],
                "headersTimeout": 0,
            } )
            .start();
    }
}
