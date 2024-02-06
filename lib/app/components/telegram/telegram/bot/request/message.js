export default class {
    #req;
    #data;

    constructor ( req, data ) {
        this.#req = req;
        this.#data = data;
    }

    // properties
    get req () {
        return this.#req;
    }

    isAborted () {
        return this.#req.isAborted;
    }

    get data () {
        return this.#data;
    }

    get id () {
        return this.#data.id;
    }

    get text () {
        return this.#data.text;
    }
}
