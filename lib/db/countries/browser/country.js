class Country {
    #data;

    constructor ( data ) {
        this.#data = data;
    }

    get id () {
        return this.#data.id;
    }

    get iso2 () {
        return this.#data.iso2;
    }

    get iso3 () {
        return this.#data.iso3;
    }

    get ison () {
        return this.#data.ison;
    }

    get name () {
        return this.#data.name;
    }

    get officialName () {
        return this.#data.officialName;
    }

    get flag () {
        return this.#data.flag;
    }

    get flagUnicode () {
        return this.#data.flagUnicode;
    }

    get tld () {
        return this.#data.tld;
    }

    get callingCode () {
        return this.#data.callingCode;
    }

    get coordinates () {
        return this.#data.coordinates;
    }
}

module.exports = Country;
