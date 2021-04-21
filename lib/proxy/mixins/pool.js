module.exports = Super =>
    class extends ( Super || Object ) {
        get defaultRotate () {
            return true;
        }
    };
