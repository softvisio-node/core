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

    async installModel ( model ) {
        return this.#api.call( "whisper/install-model", model );
    }

    async deleteModel ( model ) {
        return this.#api.call( "whisper/delete-model", model );
    }

    async transformSpeechToText ( audioFile, { model, language } = {} ) {
        return this.#api
            .upload(
                "whisper/transform-speech-to-text",
                {
                    "audio_file": audioFile,
                    model,
                    language,
                },
                {
                    "headersTimeout": 0,
                }
            )
            .start();
    }
}
