module.exports = function (api) {

    api.cache(true);

    const plugins = ["@babel/plugin-proposal-class-properties"],
        presets = [];

    return {
        plugins,
        presets
    };

};
