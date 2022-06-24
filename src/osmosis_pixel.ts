import axios from "axios";

const cache = require('node-file-cache').create({file: '../data'});

export type PixelCoords = {
    x: string,
    y: string
}

async function getCurrentPixels() {
    if (null === cache.get('osmosis_pixels')) {
        console.log('Fetching pixels from osmosis...');
        const osmosisPixels = await axios.get("https://pixels-osmosis.keplr.app/pixels", {
            headers: {
                "Content-Type": "application/json",
            },
        }).then(function (response) {
            return response.data;
        });

        cache.set('osmosis_pixels', osmosisPixels, {life: 5}); // 5 seconds
    }

    return cache.get('osmosis_pixels')
}

export async function isColor(pixelCoords: PixelCoords, colourCode: number) {
    const currentPixels = await getCurrentPixels();
    console.log('Checking pixel ' + pixelCoords.x + ',' + pixelCoords.y);
    let currentColourCode = currentPixels[pixelCoords.x][pixelCoords.y];
    if (!currentPixels[pixelCoords.x].hasOwnProperty(pixelCoords.y)) {
        currentColourCode = 0;
    }

    if (colourCode === currentColourCode) {
        console.log('No need to change pixel!');
        return true;
    } else {
        console.log('Current pixel is ' + currentColourCode + '.. changing to ' + colourCode + '!');
        return false;
    }
}
