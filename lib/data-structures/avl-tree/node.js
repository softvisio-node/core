export default class AvlTreeNode {
    #key;
    #value;
    #parent;
    #left;
    #right;
    #balanceFactor;

    constructor ( { key, value, parent, left, right, balanceFactor } = {} ) {
        this.#key = key;
        this.#value = value;
        this.#parent = parent;
        this.#left = left;
        this.#right = right;
        this.#balanceFactor = balanceFactor;
    }

    // properties
    get key () {
        return this.#key;
    }

    set key ( value ) {
        this.#key = value;
    }

    get value () {
        return this.#value;
    }

    set value ( value ) {
        this.#value = value;
    }

    get parent () {
        return this.#parent;
    }

    set parent ( value ) {
        this.#parent = value;
    }

    get left () {
        return this.#left;
    }

    set left ( value ) {
        this.#left = value;
    }

    get right () {
        return this.#right;
    }

    set right ( value ) {
        this.#right = value;
    }

    get balanceFactor () {
        return this.#balanceFactor;
    }

    set balanceFactor ( value ) {
        this.#balanceFactor = value;
    }

    // public
    toString () {
        return this.#key;
    }

    toJSON () {
        return [this.#key, this.#value];
    }

    clone () {
        return new this.constructor( { "key": this.#key, "value": this.#value } );
    }
}
