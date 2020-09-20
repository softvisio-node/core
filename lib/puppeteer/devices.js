// https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
const DESKTOP_RESOLUTIONS = [
    [1366, 768],
    [1920, 1080],
    [1536, 864],
    [1440, 900],
    [1600, 900],
    [1280, 720],
    [1280, 800],
    [1280, 1024],
    [1024, 768],
    [1680, 1050],
    [2560, 1440],
    [768, 1024],
    [1360, 768],
    [1920, 1200],
    [800, 600],
    [360, 640],
    [2048, 1152],
    [834, 1112],
    [1093, 615],
    [1024, 1366],
];

module.exports.win10 = function ( options = {} ) {
    const device = {
        "windowSize": DESKTOP_RESOLUTIONS,
        "viewport": {
            "width": null,
            "height": null,
            "deviceScaleFactor": 1,
            "isMobile": false,
            "hasTouch": false,
            "isLandscape": false,
        },
        "userAgent": null,
        "userAgentPlatform": "Windows NT 10.0; Win64; x64",
        "platform": "Win32",
    };

    if ( options.windowSize ) {
        device.windowSize = options.windowSize;
    }
    else {
        device.windowSize = device.windowSize[( Math.random() * device.windowSize.length ) | 0];
    }

    if ( options.viewportSize ) {
        device.viewport.width = options.viewportSize[0];
        device.viewport.height = options.viewportSize[1];
    }
    else {
        device.viewport.width = device.windowSize[0];
        device.viewport.height = device.windowSize[1] - 100;
    }

    return device;
};

module.exports.linux = function ( options = {} ) {
    const device = {
        "windowSize": DESKTOP_RESOLUTIONS,
        "viewport": {
            "width": null,
            "height": null,
            "deviceScaleFactor": 1,
            "isMobile": false,
            "hasTouch": false,
            "isLandscape": false,
        },
        "userAgent": null,
        "userAgentPlatform": "X11; Linux x86_64",
        "platform": "Linux x86_64",
    };

    if ( options.windowSize ) {
        device.windowSize = options.windowSize;
    }
    else {
        device.windowSize = device.windowSize[( Math.random() * device.windowSize.length ) | 0];
    }

    if ( options.viewportSize ) {
        device.viewport.width = options.viewportSize[0];
        device.viewport.height = options.viewportSize[1];
    }
    else {
        device.viewport.width = device.windowSize[0];
        device.viewport.height = device.windowSize[1] - 100;
    }

    return device;
};

// XXX
module.exports.ipad = function ( options = {} ) {
    const device = {
        "windowSize": [1024, 768],
        "viewport": {
            "width": 1024,
            "height": 768,
            "deviceScaleFactor": 2,
            "isMobile": true,
            "hasTouch": true,
            "isLandscape": true,
        },
        "userAgent": "Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1",
        "userAgentPlatform": null,
        "platform": "iPad", // XXX check
    };

    return device;
};
