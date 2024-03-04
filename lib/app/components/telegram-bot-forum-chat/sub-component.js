import Bot from "./bot.js";

export default Super =>
    class extends Super {

        // protected
        _applySubConfig () {
            super._applySubConfig();

            this._mergeSubConfig( import.meta.url );
        }

        _applySubSchema ( schema ) {
            return this._mergeSubSchema( super._applySubSchema( schema ), import.meta.url );
        }

        _buildBot () {
            return Bot( super._buildBot() );
        }
    };
