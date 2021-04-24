const Rotating = require( "./rotating" );

module.exports = class extends Rotating {

    // props
    get defaultRotate () {
        return true;
    }
};
