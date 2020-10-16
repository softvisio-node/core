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

const WINDOWS_DEVICES = ["windows10"];
const LINUX_DEVICES = ["linux"];
const DESKTOP_DEVICES = [...WINDOWS_DEVICES, ...LINUX_DEVICES];
const MOBILE_DEVICES = ["ipad"];
const ALL_DEVICES = [...DESKTOP_DEVICES, ...MOBILE_DEVICES];

class PuppeteerDevices {
    windows10 ( options = {} ) {
        const device = {
            "id": "windows10",
            "name": "Windows 10",
            "windowSize": DESKTOP_RESOLUTIONS,
            "viewportSize": [0, 0],
            "deviceScaleFactor": 1,
            "isMobile": false,
            "hasTouch": false,
            "isLandscape": false,
            "userAgent": null,
            "userAgentPlatform": "Windows NT 10.0; Win64; x64",
            "platform": "Win32",
            "webglVendor": "Intel Inc.",
            "webglRenderer": "Intel Iris OpenGL Engine",
        };

        if ( options.windowSize ) {
            device.windowSize = options.windowSize;
        }
        else {
            device.windowSize = device.windowSize[Math.floor( Math.random() * device.windowSize.length )];
        }

        if ( options.viewportSize ) {
            device.viewportSize = options.viewportSize;
        }
        else {
            device.viewportSize[0] = device.windowSize[0];
            device.viewportSize[1] = device.windowSize[1] - 100;
        }

        return device;
    }

    linux ( options = {} ) {
        const device = {
            "id": "linux",
            "name": "Linux",
            "windowSize": DESKTOP_RESOLUTIONS,
            "viewportSize": [0, 0],
            "deviceScaleFactor": 1,
            "isMobile": false,
            "hasTouch": false,
            "isLandscape": false,
            "userAgent": null,
            "userAgentPlatform": "X11; Linux x86_64",
            "platform": "Linux x86_64",
            "webglVendor": "Intel Inc.",
            "webglRenderer": "Intel Iris OpenGL Engine",
        };

        if ( options.windowSize ) {
            device.windowSize = options.windowSize;
        }
        else {
            device.windowSize = device.windowSize[Math.floor( Math.random() * device.windowSize.length )];
        }

        if ( options.viewportSize ) {
            device.viewportSize = options.viewportSize;
        }
        else {
            device.viewportSize[0] = device.windowSize[0];
            device.viewportSize[1] = device.windowSize[1] - 100;
        }

        return device;
    }

    // XXX
    ipad ( options = {} ) {
        const device = {
            "id": "ipad",
            "name": "iPad",
            "windowSize": [1024, 768],
            "viewportSize": [1024, 768],
            "deviceScaleFactor": 2,
            "isMobile": true,
            "hasTouch": true,
            "isLandscape": true,
            "userAgent": "Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1",
            "userAgentPlatform": null,
            "platform": "iPad", // XXX check
            "webglVendor": "Intel Inc.",
            "webglRenderer": "Intel Iris OpenGL Engine",
        };

        return device;
    }

    getRandomDevice () {
        const deviceName = ALL_DEVICES[Math.floor( Math.random() * ALL_DEVICES.length )];

        return this[deviceName]();
    }

    getRandomDesktopDevice () {
        const deviceName = DESKTOP_DEVICES[Math.floor( Math.random() * DESKTOP_DEVICES.length )];

        return this[deviceName]();
    }

    getRandomMobileDevice () {
        const deviceName = MOBILE_DEVICES[Math.floor( Math.random() * MOBILE_DEVICES.length )];

        return this[deviceName]();
    }

    getRandomWindowsDevice () {
        const deviceName = WINDOWS_DEVICES[Math.floor( Math.random() * WINDOWS_DEVICES.length )];

        return this[deviceName]();
    }

    getRandomLinuxDevice () {
        const deviceName = LINUX_DEVICES[Math.floor( Math.random() * LINUX_DEVICES.length )];

        return this[deviceName]();
    }
}

module.exports = new PuppeteerDevices();
